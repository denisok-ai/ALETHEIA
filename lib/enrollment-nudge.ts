/**
 * Напоминание студентам, которые записались на курс, но так и не открыли его.
 *
 * Зачем: и бесплатные (0 ₽), и платные записи иногда «повисают» — человек
 * оплатил/записался, получил письмо, но в курс не зашёл (запутался во входе,
 * отвлёкся). Раньше это никто не ловил, а для платного тарифа это потерянный
 * клиент. Джоба раз в сутки находит таких и шлёт одно письмо «как открыть курс».
 *
 * Границы:
 * - не раньше 24 ч после записи — только что записавшегося дёргать рано;
 * - не позже 7 дней — давние остывшие записи письмом не будим (иначе первый же
 *   запуск разошлёт напоминания всем историческим «не открывшим»);
 * - строго один раз на зачисление — идемпотентность через EmailDeliveryLog
 *   (module='onboarding', entityId=Enrollment.id, status='sent').
 */
import { prisma } from '@/lib/db';
import { sendTransactionalEmail, quoteTitle } from '@/lib/email-service';
import { getSystemSettings } from '@/lib/settings';

const NUDGE_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const NUDGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Предохранитель от массовой рассылки за один запуск. */
const NUDGE_MAX_PER_RUN = 20;

/** Окно записи: [не старше 7 дней; не моложе 24 часов]. Чистая функция — тестируется. */
export function nudgeWindow(now: number): { minEnrolled: Date; maxEnrolled: Date } {
  return {
    minEnrolled: new Date(now - NUDGE_MAX_AGE_MS),
    maxEnrolled: new Date(now - NUDGE_MIN_AGE_MS),
  };
}

/** Обращение по имени, только если это действительно имя, а не email-логин. */
export function personalGreeting(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  const looksLikeLogin = !n || /@/.test(n) || /^[a-z0-9_.+-]+$/i.test(n);
  return looksLikeLogin ? 'Здравствуйте!' : `Здравствуйте, ${n}!`;
}

export type NudgeAction =
  | 'sent'
  | 'failed'
  | 'would-send'
  | 'skipped-opened'
  | 'skipped-nudged';

export type NudgeOutcome = {
  enrollmentId: string;
  email: string;
  courseTitle: string;
  ageHours: number;
  action: NudgeAction;
  error?: string;
};

export type NudgeRunResult = {
  dryRun: boolean;
  scanned: number;
  sent: number;
  outcomes: NudgeOutcome[];
};

export async function nudgeInactiveEnrollees(opts: {
  dryRun: boolean;
  now?: number;
}): Promise<NudgeRunResult> {
  const now = opts.now ?? Date.now();
  const { minEnrolled, maxEnrolled } = nudgeWindow(now);

  const settings = await getSystemSettings();
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const portalTitle = settings.portal_title || 'AVATERRA';
  const loginUrl = siteUrl ? `${siteUrl}/login` : '/login';
  const supportEmail = settings.resend_notify_email?.trim() || '';

  const enrollments = await prisma.enrollment.findMany({
    where: {
      accessClosed: false,
      completedAt: null,
      enrolledAt: { gte: minEnrolled, lte: maxEnrolled },
    },
    orderBy: { enrolledAt: 'asc' },
    include: {
      user: { select: { email: true, displayName: true } },
      course: { select: { title: true } },
    },
  });

  const outcomes: NudgeOutcome[] = [];
  let sent = 0;

  for (const e of enrollments) {
    const email = e.user?.email ?? '';
    const courseTitle = e.course?.title ?? 'ваш курс';
    const ageHours = Math.round(((now - e.enrolledAt.getTime()) / 3_600_000) * 10) / 10;
    const base = { enrollmentId: e.id, email, courseTitle, ageHours };

    // Открывал курс (есть прогресс SCORM) — напоминать не о чем.
    const opened = await prisma.scormProgress.count({
      where: { userId: e.userId, courseId: e.courseId },
    });
    if (opened > 0) {
      outcomes.push({ ...base, action: 'skipped-opened' });
      continue;
    }

    // Уже слали напоминание по этому зачислению — не повторяем (идемпотентность).
    const already = await prisma.emailDeliveryLog.count({
      where: { module: 'onboarding', entityId: e.id, status: 'sent' },
    });
    if (already > 0) {
      outcomes.push({ ...base, action: 'skipped-nudged' });
      continue;
    }

    if (opts.dryRun) {
      outcomes.push({ ...base, action: 'would-send' });
      continue;
    }

    if (sent >= NUDGE_MAX_PER_RUN) break;

    const courseLabel = quoteTitle(courseTitle);
    const subject = `${portalTitle}: как открыть ваш курс ${courseLabel}`;
    const supportLine = supportEmail
      ? `<p style="font-size:14px;color:#5c5854;">Если что-то не открывается — просто ответьте на это письмо или напишите: <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`
      : '';
    const html = `<p>${personalGreeting(e.user?.displayName)}</p>
<p>Вы записаны на курс ${courseLabel}, доступ открыт — но, похоже, вы ещё не открывали его. Помогаем начать.</p>
<p>Шаг 1. Войдите в личный кабинет: <a href="${loginUrl}">${loginUrl || 'страница входа'}</a> (тот же email, что и при записи).</p>
<p>Шаг 2. Откройте раздел «Мои курсы» и нажмите на курс — там будет кнопка «Начать».</p>
<p style="font-size:14px;color:#5c5854;">Забыли пароль? На странице входа нажмите «Забыли пароль» и укажите этот email — придёт ссылка для входа.</p>
${supportLine}
<p>— команда ${portalTitle}</p>`;

    const res = await sendTransactionalEmail({
      to: email,
      subject,
      html,
      context: { module: 'onboarding', entityId: e.id, userId: e.userId },
    });

    if (res.ok) {
      sent += 1;
      outcomes.push({ ...base, action: 'sent' });
    } else {
      outcomes.push({ ...base, action: 'failed', error: res.error });
    }
  }

  return { dryRun: opts.dryRun, scanned: enrollments.length, sent, outcomes };
}

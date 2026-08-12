/**
 * Cron: целостность контента курсов (инцидент 11.08.2026 — оплатившая «Практик»
 * студентка дошла до финала и увидела «Вы завершили Демоверсию курса»: во всех
 * боевых курсах с 28.05 стоял demo-пакет, и 2,5 месяца этого никто не видел —
 * витрина, оплата и доступ выглядели исправными).
 *
 * Проверки по активным тарифам витрины:
 *  - платный тариф привязан к курсу;
 *  - у SCORM-курса задан scormPath и файл входа существует на диске;
 *  - в платном курсе не установлен demo/trial-пакет (по title манифеста).
 *    Для бесплатных тарифов demo — норма (это и есть «введение»).
 *
 * Алерт в Telegram админам при появлении/изменении проблем и при восстановлении.
 * Состояние в SystemSetting — тот же подход, что paykeeper-health.
 *
 * Расписание: раз в сутки (/etc/cron.d/aletheia-http-cron → cron-http-call.sh
 * content-integrity). ?dry=1 — показать проблемы без алертов и heartbeat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { access, readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { probeTelegramApi } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATE_KEY = 'content_integrity_state';
const DEMO_TITLE_RE = /(demo|демо|trial)/i;

type IntegrityState = {
  status: 'ok' | 'fail';
  since: string;
  problems: string[];
};

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath);
    return true;
  } catch {
    return false;
  }
}

/** Title пакета: из Course.scormManifest, при отсутствии — из imsmanifest.xml на диске. */
async function resolveManifestTitle(course: {
  scormPath: string;
  scormManifest: string | null;
}): Promise<string> {
  try {
    const parsed = JSON.parse(course.scormManifest ?? '{}') as { title?: unknown };
    if (typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim();
  } catch {
    // повреждённый JSON — падаем на чтение манифеста с диска
  }
  const pkgRoot = course.scormPath.match(/^(courses-[^/]+\/v\d+)\//)?.[1];
  if (!pkgRoot) return '';
  try {
    const xml = await readFile(
      path.join(process.cwd(), 'public', 'uploads', 'scorm', pkgRoot, 'imsmanifest.xml'),
      'utf-8'
    );
    return xml.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

async function collectProblems(): Promise<string[]> {
  const problems: string[] = [];
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { course: true },
  });

  for (const s of services) {
    if (!s.course) {
      if (s.price > 0) {
        problems.push(`Платный тариф «${s.name}» (${s.slug}) активен, но не привязан к курсу`);
      }
      continue;
    }
    const c = s.course;
    if (c.courseFormat !== 'scorm') continue;

    if (!c.scormPath) {
      problems.push(`Курс «${c.title}» (тариф «${s.name}»): не задан scormPath — плеер пуст`);
      continue;
    }
    const entryAbs = path.join(process.cwd(), 'public', 'uploads', 'scorm', c.scormPath);
    if (!(await fileExists(entryAbs))) {
      problems.push(`Курс «${c.title}»: файл входа SCORM отсутствует на диске (${c.scormPath})`);
    }
    if (s.price > 0) {
      const title = await resolveManifestTitle({
        scormPath: c.scormPath,
        scormManifest: c.scormManifest,
      });
      if (DEMO_TITLE_RE.test(title)) {
        problems.push(
          `Платный тариф «${s.name}»: в курсе «${c.title}» установлен демо-пакет («${title}»)`
        );
      }
    }
  }

  // Связность с Telegram: egress умирал молча (03–12.08.2026 — 9 дней без
  // бота и алертов). Алерт об этой проблеме уйдёт почтовым дублёром
  // (notifyAdminsTelegram при полном отказе Telegram шлёт email).
  const tg = await probeTelegramApi();
  if (!tg.ok) {
    problems.push(
      `Telegram недоступен с сервера (${tg.error ?? 'ошибка'}): бот, алерты и автоимпорт канала не работают — проверьте мост/VPN (HTTPS_PROXY)`
    );
  }

  return problems;
}

async function readState(): Promise<IntegrityState | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: STATE_KEY } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as IntegrityState;
  } catch {
    return null;
  }
}

async function writeState(state: IntegrityState): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: STATE_KEY },
    update: { value: JSON.stringify(state) },
    create: { key: STATE_KEY, value: JSON.stringify(state), category: 'monitoring' },
  });
}

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const problems = await collectProblems();
  const status: IntegrityState['status'] = problems.length ? 'fail' : 'ok';

  if (!dryRun) {
    const prev = await readState();
    const changed =
      (prev?.status ?? 'ok') !== status ||
      JSON.stringify(prev?.problems ?? []) !== JSON.stringify(problems);

    if (changed && status === 'fail') {
      notifyAdminsTelegramAsync('content_integrity', [
        'Проверка контента курсов нашла проблемы:',
        ...problems.map((p) => `• ${p}`),
        'Витрина и оплата при этом выглядят исправными — студенты получают не тот контент.',
      ]);
    } else if (changed && status === 'ok' && prev?.status === 'fail') {
      notifyAdminsTelegramAsync('content_integrity', [
        'Проблемы с контентом курсов устранены, все проверки проходят.',
      ]);
    }

    if (changed || !prev) {
      await writeState({
        status,
        since: (prev?.status ?? 'ok') === status && prev ? prev.since : new Date().toISOString(),
        problems,
      });
    }
    await markCronOk('content-integrity');
  }

  return NextResponse.json({ ok: status === 'ok', problems, dryRun });
}

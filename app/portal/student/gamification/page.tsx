/**
 * Студент: история начислений заряда (геймификация).
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { PORTAL_PATH } from '@/lib/portal-paths';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { gamificationSourceLabelRu } from '@/lib/gamification-source-labels';

export const metadata: Metadata = { title: 'История заряда' };

function formatMetaDescription(meta: Record<string, unknown>, source: string): string | null {
  if (source === 'verification_approved') {
    const title = meta.courseTitle && typeof meta.courseTitle === 'string' ? meta.courseTitle.trim() : '';
    if (title) return `«${title}» · проверка домашнего задания`;
    return 'Проверка домашнего задания';
  }
  if (meta.courseTitle && typeof meta.courseTitle === 'string') {
    return meta.courseTitle;
  }
  if (meta.verificationId && typeof meta.verificationId === 'string') {
    return 'Практическое задание';
  }
  if (meta.courseId && typeof meta.courseId === 'string') {
    return `Курс: ${meta.courseId.slice(0, 8)}…`;
  }
  return null;
}

export default async function StudentGamificationHistoryPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="portal-card p-6 max-w-3xl">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  /** Любая роль в ЛК студента видит свою историю заряда (админ/менеджер не уходят редиректом в админку). */
  const events = await prisma.gamificationXpEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="w-full max-w-3xl space-y-4">
      <PageHeader
        items={[
          { href: PORTAL_PATH.studentDashboard, label: 'Дашборд' },
          { label: 'История заряда' },
        ]}
        title="История заряда"
        description="Уроки (SCORM), одобренное домашнее задание, ручные правки администратора. Повтор по тому же уроку в SCORM не дублирует заряд."
      />

      <div className="portal-card p-4 md:p-6">
        <p className="text-sm text-[var(--portal-text-muted)] mb-4">
          Подробнее о шкале и бейджах:{' '}
          <Link href="/portal/student/help#gamification" className="text-[var(--portal-accent)] hover:underline font-medium">
            раздел «Уровни заряда» в Помощи
          </Link>
          .
        </p>

        {events.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">
            Пока нет записей. Завершайте уроки в курсах и сдавайте домашние задания на проверку — заряд появится на{' '}
            <Link href={PORTAL_PATH.studentDashboard} className="text-[var(--portal-accent)] hover:underline">
              дашборде
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-[var(--portal-border)]">
            {events.map((row) => {
              let meta: Record<string, unknown> = {};
              try {
                meta = JSON.parse(row.meta) as Record<string, unknown>;
              } catch {
                meta = {};
              }
              const detail = formatMetaDescription(meta, row.source);
              const dateStr = new Date(row.createdAt).toLocaleString('ru', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const sign = row.delta >= 0 ? '+' : '';
              return (
                <li key={row.id} className="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--portal-text)]">{gamificationSourceLabelRu(row.source)}</p>
                    {detail && (
                      <p className="text-xs text-[var(--portal-text-muted)] mt-0.5 truncate" title={detail}>
                        {detail}
                      </p>
                    )}
                    <time className="text-[0.7rem] text-[var(--portal-text-soft)] mt-1 block">{dateStr}</time>
                    {row.source === 'verification_approved' && (
                      <Link
                        href="/portal/student/verifications"
                        className="text-xs text-[var(--portal-accent)] hover:underline mt-1 inline-block"
                      >
                        Мои задания на проверку
                      </Link>
                    )}
                  </div>
                  <div className="text-sm sm:text-right shrink-0">
                    <span className={row.delta >= 0 ? 'text-[#15803D]' : 'text-[#B45309]'}>
                      {sign}
                      {row.delta}
                    </span>
                    <span className="text-[var(--portal-text-muted)] mx-1">→</span>
                    <span className="text-[var(--portal-text)] font-medium">{row.balanceAfter}</span>
                    <span className="text-xs text-[var(--portal-text-soft)] ml-1">всего</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

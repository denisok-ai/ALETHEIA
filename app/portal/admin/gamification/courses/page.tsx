/**
 * Админ: заряд по курсам — агрегаты из журнала GamificationXpEvent.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { getGamificationXpAggregatesByCourse } from '@/lib/gamification-by-course-stats';

export const metadata: Metadata = { title: 'Заряд по курсам' };

export default async function AdminGamificationCoursesPage() {
  const { rows, warning } = await getGamificationXpAggregatesByCourse();

  return (
    <div className="w-full max-w-4xl space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/gamification', label: 'Геймификация' },
          { label: 'Заряд по курсам' },
        ]}
        title="Заряд по курсам"
        description="Сумма начислений и число событий журнала с привязкой к курсу (SCORM, верификации и др.). События без courseId в meta сюда не попадают."
      />

      {warning && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{warning}</p>
      )}

      <div className="portal-card p-6">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">
            Нет данных с указанным курсом в журнале или журнал пуст.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[var(--portal-text-muted)]">
                  <th className="py-2 pr-3 font-medium">Курс</th>
                  <th className="py-2 pr-3 font-medium text-right">Сумма заряда (Δ)</th>
                  <th className="py-2 font-medium text-right">Событий</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.courseId} className="border-b border-[#F1F5F9]">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/portal/admin/courses/${r.courseId}`}
                        className="text-[var(--portal-accent)] hover:underline font-medium"
                      >
                        {r.courseTitle ?? r.courseId}
                      </Link>
                      {!r.courseTitle && (
                        <span className="block text-xs text-[var(--portal-text-soft)] mt-0.5">
                          Курс не найден в справочнике — проверьте id.
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {r.totalXp > 0 ? `+${r.totalXp}` : r.totalXp}
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.eventCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

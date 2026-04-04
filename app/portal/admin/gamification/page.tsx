/**
 * Админ: параметры геймификации (заряд / уровень заряда).
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/portal/PageHeader';
import { GamificationSettingsForm } from '@/components/portal/admin/GamificationSettingsForm';
import { GAMIFICATION_BADGES } from '@/lib/gamification';

export const metadata: Metadata = { title: 'Геймификация' };

export default function AdminGamificationPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Геймификация' },
        ]}
        title="Геймификация"
        description="Уровни заряда на дашборде студента: подписи вроде «Заряд: 78%», «+15 к уровню заряда», шкала-батарейка. Ниже — числовые пороги из базы; бейджи — в коде."
      />

      <div className="portal-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--portal-text)]">Параметры заряда</h2>
          <p className="text-sm text-[var(--portal-text-muted)] mt-1">
            Эти значения совпадают с подсказками на дашборде и с начислением за SCORM (первое завершение урока).
          </p>
        </div>
        <GamificationSettingsForm />
      </div>

      <div className="portal-card p-6 space-y-2">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Бейджи (пороги по накопленному заряду)</h2>
        <ul className="text-sm text-[var(--portal-text-muted)] list-disc list-inside space-y-1">
          {GAMIFICATION_BADGES.map((b) => (
            <li key={b.minXp}>
              {b.emoji} {b.label} — от {b.minXp} ед. накопленного заряда
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--portal-text-soft)] pt-2">
          Изменение порогов бейджей — правка массива <code className="rounded bg-[#F1F5F9] px-1">GAMIFICATION_BADGES</code> в{' '}
          <code className="rounded bg-[#F1F5F9] px-1">lib/gamification.ts</code> и деплой.
        </p>
      </div>
    </div>
  );
}

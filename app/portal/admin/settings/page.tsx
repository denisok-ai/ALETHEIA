/**
 * Admin: global settings — editable (DB) + env indicators, doc links, version.
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/portal/PageHeader';

export const metadata: Metadata = { title: 'Настройки' };

import { SettingsEnvIndicators } from './SettingsEnvIndicators';
import { SettingsForms } from './SettingsForms';
import { HealthStatus } from './HealthStatus';
import packageJson from '../../../../package.json';

export default function AdminSettingsPage() {
  return (
    <div className="w-full max-w-none space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Настройки' },
        ]}
        title="Настройки"
        description="Параметры портала и интеграций. Редактируемые значения сохраняются в БД; NEXTAUTH_SECRET и DATABASE_URL — только в .env."
      />

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">О системе</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Версия: {packageJson.version}</p>
        <p className="mt-0.5 text-xs text-[var(--portal-text-muted)]">Окружение: {process.env.NODE_ENV ?? 'development'}</p>
        <HealthStatus />
      </div>

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Состояние интеграций</h2>
        <SettingsEnvIndicators />
      </div>

      <SettingsForms />

      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Документация</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <a href="https://github.com/vercel/next.js/blob/canary/docs/02-app/01-api-reference/configuration/next-config-js.md" target="_blank" rel="noopener noreferrer" className="text-[#6366F1] hover:underline">
              Next.js конфигурация
            </a>
          </li>
          <li>
            <span className="text-[var(--portal-text-muted)]">Локальный запуск и Prisma — см. docs/Local-Prisma.md в репозитории</span>
          </li>
          <li>
            <span className="text-[var(--portal-text-muted)]">Деплой — см. docs/Deploy.md в репозитории</span>
          </li>
          <li>
            <span className="text-[var(--portal-text-muted)]">Переменные окружения и БД — docs/Env-Config.md; аудит оплат — docs/Payments-Audit-Checklist.md</span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-[var(--portal-text-muted)]">
          NEXTAUTH_SECRET и DATABASE_URL задаются только в <code className="rounded bg-[#F1F5F9] px-1.5 py-0.5">.env</code> (или в панели деплоя). Остальные параметры редактируются в формах выше и сохраняются в БД.
        </p>
      </div>
    </div>
  );
}

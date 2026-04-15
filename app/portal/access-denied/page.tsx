/**
 * Явное сообщение при попытке открыть раздел портала без нужной роли (RBAC в middleware).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { getUser } from '@/lib/auth';
import { getPortalHomeForRole } from '@/lib/portal-role-home';

export const metadata: Metadata = { title: 'Доступ ограничен' };

type Props = {
  searchParams: { section?: string };
};

export default async function PortalAccessDeniedPage({ searchParams }: Props) {
  const section = searchParams.section === 'manager' ? 'manager' : 'admin';
  const { profile } = await getUser();
  const role = profile?.role ?? 'user';
  const primary = getPortalHomeForRole(role);

  const description =
    section === 'manager'
      ? 'Раздел для кураторов и менеджеров школы. Доступ есть у учётных записей с ролью «Менеджер» или «Администратор». Если вам нужен доступ — обратитесь к администратору.'
      : 'Раздел администрирования: курсы, пользователи, настройки портала. Доступен только роли «Администратор». Если адрес открыт по ошибке, вернитесь в личный кабинет.';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        items={[{ href: '/portal', label: 'Портал' }, { label: 'Доступ' }]}
        title="Доступ ограничен"
        description={description}
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/portal"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] px-4 py-2 text-sm font-medium text-[var(--portal-text)] transition hover:bg-[var(--portal-surface-hover)]"
        >
          На главную портала
        </Link>
        <Link
          href={primary.path}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--portal-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {primary.label}
        </Link>
      </div>
    </div>
  );
}

/**
 * Единый центр почты в админке: вкладки обзора, доставки, ящиков, входящих и журналов.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Почта' };

import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { loadMailCenterPayload } from '@/lib/mail-center-server';
import { MailCenterClient } from './MailCenterClient';

export default async function MailCenterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Почта' }]} title="Почта" description="Требуется авторизация." />
      </div>
    );
  }

  const payload = await loadMailCenterPayload();

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Почта' },
        ]}
        title="Почта"
        description="Один вход к доставке писем, ящикам @avaterra.pro, входящим IMAP, оперативным письмам и рассылкам."
      />
      <Suspense
        fallback={
          <div className="portal-card flex flex-col items-center justify-center gap-3 p-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal-accent)] border-t-transparent" aria-hidden />
            <p className="text-sm text-[var(--portal-text-muted)]">Загрузка центра почты…</p>
          </div>
        }
      >
        <MailCenterClient {...payload} />
      </Suspense>
    </div>
  );
}

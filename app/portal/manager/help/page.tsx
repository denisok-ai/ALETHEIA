/**
 * Менеджер: страница «Помощь».
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/portal/PageHeader';

export const metadata: Metadata = { title: 'Помощь' };

import { HelpContent } from '@/components/portal/HelpContent';

export default function ManagerHelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/manager/dashboard', label: 'Дашборд' },
          { label: 'Помощь' },
        ]}
        title="Помощь"
        description="Справка и тикеты"
      />
      <HelpContent supportHref="/portal/manager/tickets" portalRole="manager" />
    </div>
  );
}

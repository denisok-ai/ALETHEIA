/**
 * Админ: страница «Помощь».
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/portal/PageHeader';

export const metadata: Metadata = { title: 'Помощь' };

import { HelpContent } from '@/components/portal/HelpContent';

export default function AdminHelpPage() {
  return (
    <div className="space-y-6 w-full max-w-4xl">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Помощь' },
        ]}
        title="Помощь"
        description="Справка и документация"
      />
      <HelpContent portalRole="admin" />
    </div>
  );
}

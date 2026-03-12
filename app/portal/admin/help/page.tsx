/**
 * Админ: страница «Помощь».
 */
import { PageHeader } from '@/components/portal/PageHeader';
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
      <HelpContent role="admin" />
    </div>
  );
}

/**
 * Студент: страница «Помощь».
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/portal/PageHeader';

export const metadata: Metadata = { title: 'Помощь' };

import { HelpContent } from '@/components/portal/HelpContent';

export default function StudentHelpPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { label: 'Помощь' },
        ]}
        title="Помощь"
        description="Частые вопросы и контакты"
      />
      <HelpContent supportHref="/portal/student/support" role="student" />
    </div>
  );
}

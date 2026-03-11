/**
 * Студент: страница «Помощь».
 */
import { PageHeader } from '@/components/portal/PageHeader';
import { HelpContent } from '@/components/portal/HelpContent';

export default function StudentHelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { label: 'Помощь' },
        ]}
        title="Помощь"
        description="Частые вопросы и поддержка"
      />
      <HelpContent supportHref="/portal/student/support" role="student" />
    </div>
  );
}

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PORTAL_PATH } from '@/lib/portal-paths';

export function StudentCourseAccessDenied() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        items={[
          { href: PORTAL_PATH.studentDashboard, label: 'Дашборд' },
          { href: '/portal/student/courses', label: 'Мои курсы' },
          { label: 'Доступ закрыт' },
        ]}
        title="Нет доступа"
        description="У вас нет доступа к этому курсу. Запишитесь на курс или обратитесь к администратору."
      />
      <div className="portal-card p-6">
        <Link href="/portal/student/courses" className={cn(buttonVariants({ variant: 'secondary' }))}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          К моим курсам
        </Link>
      </div>
    </div>
  );
}

/**
 * Student portal: оболочка с сайдбаром в клиентском модуле.
 */
import type { ReactNode } from 'react';
import { StudentPortalShell } from '@/components/portal/StudentPortalShell';

export default function StudentPortalLayout({ children }: { children: ReactNode }) {
  return <StudentPortalShell>{children}</StudentPortalShell>;
}

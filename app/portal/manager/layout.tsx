/**
 * Manager portal: оболочка с сайдбаром в клиентском модуле.
 */
import type { ReactNode } from 'react';
import { ManagerPortalShell } from '@/components/portal/ManagerPortalShell';

export default function ManagerPortalLayout({ children }: { children: ReactNode }) {
  return <ManagerPortalShell>{children}</ManagerPortalShell>;
}

/**
 * Admin portal: оболочка с сайдбаром в клиентском модуле (см. AdminPortalShell).
 */
import type { ReactNode } from 'react';
import { AdminPortalShell } from '@/components/portal/AdminPortalShell';

export default function AdminPortalLayout({ children }: { children: ReactNode }) {
  return <AdminPortalShell>{children}</AdminPortalShell>;
}

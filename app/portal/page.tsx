/**
 * Portal entry: redirect to role-specific dashboard.
 * Ensures admin → admin dashboard, manager → manager dashboard, user → student dashboard.
 */
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function PortalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?redirect=/portal');
  }

  const role = (session.user as { role?: string })?.role ?? 'user';

  if (role === 'admin') {
    redirect('/portal/admin/dashboard');
  }
  if (role === 'manager') {
    redirect('/portal/manager/dashboard');
  }

  redirect('/portal/student/dashboard');
}

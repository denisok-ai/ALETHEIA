/**
 * Portal entry: redirect to role-specific dashboard.
 * Ensures admin → admin dashboard, manager → manager dashboard, user → student dashboard.
 */
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPortalHomeForRole } from '@/lib/portal-role-home';

export default async function PortalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?redirect=/portal');
  }

  const role = (session.user as { role?: string })?.role ?? 'user';
  redirect(getPortalHomeForRole(role).path);
}

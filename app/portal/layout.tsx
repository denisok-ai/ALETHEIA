/**
 * Portal shell: header with user session. Role-specific sidebar in (student)|(admin)|(manager) layouts.
 */
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { PortalHeader } from '@/components/portal/PortalHeader';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-bg-cream">
      <PortalHeader user={user} profile={profile} />
      {children}
    </div>
  );
}

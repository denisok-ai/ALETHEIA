/**
 * Portal shell: header + role-specific sidebar. PortalUIProvider for mobile menu state.
 */
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { PortalUIProvider } from '@/components/portal/PortalUIProvider';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ user, profile }, settings] = await Promise.all([getUser(), getSystemSettings()]);
  if (!user) redirect('/login');

  return (
    <PortalUIProvider user={user} profile={profile} portalTitle={settings.portal_title || 'AVATERRA'}>
      {children}
    </PortalUIProvider>
  );
}

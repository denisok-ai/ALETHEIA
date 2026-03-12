/**
 * Portal shell: header + role-specific sidebar. PortalUIProvider for mobile menu state.
 * Для студента при каждом входе привязываем оплаченные заказы по email (страховка после оплаты без регистрации).
 */
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { claimPaidOrdersForUser } from '@/lib/claim-orders';
import { PortalUIProvider } from '@/components/portal/PortalUIProvider';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ user, profile }, settings] = await Promise.all([getUser(), getSystemSettings()]);
  if (!user) redirect('/login');

  if (profile?.role === 'user' && user.email) {
    try {
      await claimPaidOrdersForUser(user.id, user.email.trim().toLowerCase());
    } catch (e) {
      console.error('Portal: claim orders', e);
    }
  }

  return (
    <PortalUIProvider user={user} profile={profile} portalTitle={settings.portal_title || 'AVATERRA'}>
      {children}
    </PortalUIProvider>
  );
}

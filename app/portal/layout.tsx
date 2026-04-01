/**
 * Portal shell: header + role-specific sidebar. PortalUIProvider for mobile menu state.
 * Для студента при первом входе в сессию привязываем оплаченные заказы по email (через API + cookie).
 */
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { PortalUIProvider } from '@/components/portal/PortalUIProvider';
import { PortalCommandPalette } from '@/components/portal/PortalCommandPalette';
import { PortalHeaderWrapper } from '@/components/portal/PortalHeaderWrapper';
import { ClaimOrdersTrigger } from '@/components/portal/ClaimOrdersTrigger';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const title = settings?.portal_title || 'AVATERRA';
  return {
    title: { default: `Портал ${title}`, template: `%s | ${title}` },
  };
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, settings] = await Promise.all([
    getUser(),
    getSystemSettings(),
  ]);
  const { user, profile } = session;
  const unreadCount =
    user?.id && profile?.role === 'user'
      ? await prisma.notification.count({ where: { userId: user.id, isRead: false } })
      : 0;
  if (!user) redirect('/login');

  if (profile?.role === 'user' && user.id) {
    const dbProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { emailVerifiedAt: true },
    });
    if (dbProfile && !dbProfile.emailVerifiedAt) {
      redirect('/verify-email-required');
    }
  }

  const portalTitle = settings.portal_title || 'AVATERRA';

  return (
    <PortalUIProvider user={user} profile={profile} portalTitle={portalTitle}>
      <PortalCommandPalette />
      {profile?.role === 'user' && <ClaimOrdersTrigger />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PortalHeaderWrapper user={user} profile={profile} portalTitle={portalTitle} unreadNotificationCount={unreadCount} />
        <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </PortalUIProvider>
  );
}

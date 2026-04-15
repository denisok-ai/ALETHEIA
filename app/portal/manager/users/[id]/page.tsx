/**
 * Manager: read-only карточка пользователя (профиль, курсы, сертификаты, тикеты).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { levelFromTotalXp } from '@/lib/gamification';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { ManagerUserDetailView } from './ManagerUserDetailView';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true } } },
  });
  if (!user) return { title: 'Пользователь' };
  const displayName = user.profile?.displayName ?? user.displayName ?? user.email ?? 'Пользователь';
  return { title: String(displayName).slice(0, 60) };
}

export default async function ManagerUserDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== 'manager' && role !== 'admin')) {
    notFound();
  }

  const { id: userId } = await params;

  const [user, energyRow, xpEvents, gamification] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        enrollments: { include: { course: { select: { id: true, title: true } } } },
        certificates: { include: { course: { select: { title: true } } } },
        tickets: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    }),
    prisma.userEnergy.findUnique({ where: { userId } }),
    prisma.gamificationXpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    getGamificationNumbers(),
  ]);

  if (!user) notFound();

  const xpTotal = energyRow?.xp ?? 0;
  const levelDisplay = levelFromTotalXp(xpTotal, gamification.xpPerLevel);

  const profile = user.profile;
  const displayName = String(profile?.displayName ?? user.displayName ?? user.email ?? 'Пользователь');
  const email = profile?.email ?? user.email;

  return (
    <ManagerUserDetailView
      displayName={displayName}
      email={email}
      profileRole={profile?.role ?? null}
      profileStatus={profile?.status ?? null}
      viewerRole={role === 'admin' ? 'admin' : 'manager'}
      enrollments={user.enrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course?.title ?? null,
        enrolledAt: e.enrolledAt.toISOString(),
      }))}
      certificates={user.certificates.map((c) => ({
        id: c.id,
        courseId: c.courseId,
        courseTitle: c.course?.title ?? null,
        certNumber: c.certNumber,
      }))}
      tickets={user.tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
      }))}
      xpTotal={xpTotal}
      levelDisplay={levelDisplay}
      xpEvents={xpEvents.map((ev) => ({
        id: ev.id,
        createdAt: ev.createdAt.toISOString(),
        source: ev.source,
        delta: ev.delta,
        balanceAfter: ev.balanceAfter,
      }))}
      gamification={{
        xpLessonComplete: gamification.xpLessonComplete,
        xpVerificationApproved: gamification.xpVerificationApproved,
      }}
    />
  );
}

/**
 * Student: profile — view and edit displayName.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { ProfileEditForm } from './ProfileEditForm';

export default async function StudentProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Профиль</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true, email: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = profile?.email ?? user?.email ?? null;
  const displayName = profile?.displayName ?? null;

  return (
    <div>
      <Breadcrumbs items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Профиль' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Профиль</h1>
      <p className="mt-1 text-text-muted">Ваши данные и настройки</p>
      <ProfileEditForm initialDisplayName={displayName} email={email} />
    </div>
  );
}

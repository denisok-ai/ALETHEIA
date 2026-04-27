/**
 * Admin: детализация посещений по пользователю — список сессий (IP, вход, выход).
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { VisitDetailClient } from './VisitDetailClient';

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true } } },
  });
  const name = user?.profile?.displayName ?? user?.email ?? 'Пользователь';
  return { title: `Посещения: ${String(name).slice(0, 40)}` };
}

export default async function VisitDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Мониторинг' }]} title="Посещения" description="Требуется авторизация." />
      </div>
    );
  }

  const { userId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/monitoring', label: 'Мониторинг' },
          { label: 'Посещения пользователя' },
        ]}
        title="Время посещения"
        description="Список сессий пользователя за период."
      />
      <VisitDetailClient userId={userId} />
    </div>
  );
}

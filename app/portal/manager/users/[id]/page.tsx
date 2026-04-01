/**
 * Manager: read-only карточка пользователя (профиль, курсы, сертификаты, тикеты).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ArrowLeft, User, BookOpen, Award, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      enrollments: { include: { course: { select: { id: true, title: true } } } },
      certificates: { include: { course: { select: { title: true } } } },
      tickets: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });

  if (!user) notFound();

  const profile = user.profile;
  const displayName = profile?.displayName ?? user.displayName ?? user.email;
  const email = profile?.email ?? user.email;

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/manager/dashboard', label: 'Дашборд' },
          { href: '/portal/manager/users', label: 'Пользователи' },
          { label: String(displayName ?? '') },
        ]}
        title={String(displayName ?? 'Пользователь')}
        description={email ?? undefined}
        actions={
          <Link
            href="/portal/manager/users"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:text-[var(--portal-accent)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <User className="h-4 w-4" />
            Профиль
          </h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-[var(--portal-text-muted)] inline">Имя: </dt><dd className="inline">{displayName ?? '—'}</dd></div>
            <div><dt className="text-[var(--portal-text-muted)] inline">Email: </dt><dd className="inline">{email ?? '—'}</dd></div>
            <div><dt className="text-[var(--portal-text-muted)] inline">Роль: </dt><dd className="inline">{profile?.role ?? 'user'}</dd></div>
            <div><dt className="text-[var(--portal-text-muted)] inline">Статус: </dt><dd className="inline">{profile?.status ?? 'active'}</dd></div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <BookOpen className="h-4 w-4" />
            Записи на курсы ({user.enrollments.length})
          </h2>
          {user.enrollments.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет записей</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {user.enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <Link
                    href={`/portal/student/courses/${e.courseId}`}
                    className="text-[var(--portal-text)] hover:text-[var(--portal-accent)] hover:underline"
                  >
                    {e.course?.title ?? e.courseId}
                  </Link>
                  <span className="text-[var(--portal-text-muted)] text-xs">
                    {format(new Date(e.enrolledAt), 'dd.MM.yyyy', { locale: ru })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <Award className="h-4 w-4" />
            Сертификаты ({user.certificates.length})
          </h2>
          {user.certificates.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет сертификатов</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {user.certificates.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/portal/student/courses/${c.courseId}`}
                    className="text-[var(--portal-text)] hover:text-[var(--portal-accent)] hover:underline"
                  >
                    {c.course?.title ?? '—'}
                  </Link>
                  <span className="text-[var(--portal-text-muted)] ml-2">№{c.certNumber}</span>
                  {role === 'admin' && (
                    <Link
                      href={`/api/portal/admin/certificates/${c.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-[var(--portal-accent)] hover:underline"
                    >
                      Скачать
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <MessageSquare className="h-4 w-4" />
            Тикеты ({user.tickets.length})
          </h2>
          {user.tickets.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет обращений</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {user.tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/portal/manager/tickets/${t.id}`}
                    className="text-[var(--portal-accent)] hover:underline font-medium"
                  >
                    {t.subject}
                  </Link>
                  <span className={`ml-2 status-badge ${t.status === 'open' ? 'badge-warn' : t.status === 'in_progress' ? 'badge-info' : 'badge-active'}`}>
                    {t.status === 'open' ? 'Открыт' : t.status === 'in_progress' ? 'В работе' : t.status === 'resolved' ? 'Решён' : 'Закрыт'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

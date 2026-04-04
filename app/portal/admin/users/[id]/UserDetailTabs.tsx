'use client';

/**
 * Табы карточки пользователя: Профиль, Записи на курсы, Сертификаты, Заказы, Тикеты.
 */
import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { User, BookOpen, Award, CreditCard, MessageSquare, FolderTree, Send, Zap } from 'lucide-react';
import { UserEnergyAdminBlock } from '@/components/portal/admin/UserEnergyAdminBlock';
import { UserDetailClient } from './UserDetailClient';
import {
  UserCommunicationsBlock,
  type NotificationLogItem,
  type MailingLogItem,
  type InAppNotificationItem,
} from './UserCommunicationsBlock';
import { UserGroupsBlock } from './UserGroupsBlock';
import { UserRecentActions } from './UserRecentActions';
import { EnrollUserOnCourse } from './EnrollUserOnCourse';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';

const TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'groups', label: 'Группы', icon: FolderTree },
  { id: 'communications', label: 'Коммуникации', icon: Send },
  { id: 'enrollments', label: 'Записи на курсы', icon: BookOpen },
  { id: 'energy', label: 'Уровень заряда', icon: Zap },
  { id: 'certificates', label: 'Сертификаты', icon: Award },
  { id: 'orders', label: 'Заказы', icon: CreditCard },
  { id: 'tickets', label: 'Тикеты', icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]['id'];

export type EnrollmentItem = {
  id: string;
  courseId: string;
  courseTitle: string | null;
  enrolledAt: string;
};

export type CertificateItem = {
  id: string;
  courseTitle: string | null;
  certNumber: string;
  issuedAt: string;
};

export type OrderItem = {
  id: number;
  orderNumber: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export type TicketItem = {
  id: string;
  subject: string;
  status: string;
};

export type CourseOption = { id: string; title: string };

export function UserDetailTabs({
  userId,
  accountEmail,
  createdAt,
  initialRole,
  initialStatus,
  initialDisplayName,
  initialEmail,
  courses,
  enrollments,
  certificates,
  orders,
  tickets,
  notificationLogs,
  mailingLogs,
  inAppNotifications,
}: {
  userId: string;
  accountEmail: string;
  createdAt: string;
  initialRole: string;
  initialStatus: string;
  initialDisplayName: string | null;
  initialEmail: string | null;
  courses: CourseOption[];
  enrollments: EnrollmentItem[];
  certificates: CertificateItem[];
  orders: OrderItem[];
  tickets: TicketItem[];
  notificationLogs: NotificationLogItem[];
  mailingLogs: MailingLogItem[];
  inAppNotifications: InAppNotificationItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const enrolledCourseIds = enrollments.map((e) => e.courseId);

  return (
    <div className="space-y-4">
      <div className="border-b border-[#E2E8F0]">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Разделы пользователя">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--portal-accent)] text-[var(--portal-accent)]'
                    : 'border-transparent text-[var(--portal-text-muted)] hover:border-[#E2E8F0] hover:text-[var(--portal-text)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'groups' && <UserGroupsBlock userId={userId} />}

      {activeTab === 'communications' && (
        <UserCommunicationsBlock
          userId={userId}
          accountEmail={accountEmail}
          notificationLogs={notificationLogs}
          mailingLogs={mailingLogs}
          inAppNotifications={inAppNotifications}
        />
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <UserDetailClient
            userId={userId}
            accountEmail={accountEmail}
            createdAt={createdAt}
            initialRole={initialRole}
            initialStatus={initialStatus}
            initialDisplayName={initialDisplayName}
            initialEmail={initialEmail}
          />
          <Card title="Последние действия">
            <UserRecentActions userId={userId} />
          </Card>
        </div>
      )}

      {activeTab === 'energy' && (
        <UserEnergyAdminBlock userId={userId} profileRole={initialRole} />
      )}

      {activeTab === 'enrollments' && (
        <Card title="Записи на курсы" description="Зачисление на курс и список записей">
          <EnrollUserOnCourse
            userId={userId}
            courses={courses}
            enrolledCourseIds={enrolledCourseIds}
          />
          {enrollments.length === 0 ? (
            <EmptyState
              className="mt-3 py-8"
              title="Нет записей на курсы"
              description="Зачислите пользователя на курс через форму выше"
              icon={<BookOpen className="h-8 w-8" />}
            />
          ) : (
            <ul className="mt-3 space-y-1">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <Link
                    href={`/portal/admin/courses/${e.courseId}`}
                    className="text-[var(--portal-accent)] hover:underline"
                  >
                    {e.courseTitle ?? e.courseId}
                  </Link>
                  <span className="text-xs text-[var(--portal-text-muted)]">
                    {format(new Date(e.enrolledAt), 'dd.MM.yyyy')}
                  </span>
                  <Link
                    href={`/portal/admin/courses/${e.courseId}/enrollments/${userId}`}
                    className="text-xs text-[var(--portal-accent)] hover:underline"
                  >
                    Прогресс
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {activeTab === 'certificates' && (
        <Card title="Сертификаты">
          {certificates.length === 0 ? (
            <EmptyState
              className="py-8"
              title="Нет сертификатов"
              description="Сертификаты появятся после прохождения курсов"
              icon={<Award className="h-8 w-8" />}
            />
          ) : (
            <ul className="space-y-1">
              {certificates.map((c) => (
                <li key={c.id}>
                  {c.courseTitle ?? '—'} — {c.certNumber}
                  <span className="ml-2 text-xs text-[var(--portal-text-muted)]">
                    {format(new Date(c.issuedAt), 'dd.MM.yyyy')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {activeTab === 'orders' && (
        <Card title="Заказы">
          {orders.length === 0 ? (
            <EmptyState
              className="py-8"
              title="Нет заказов"
              description="Заказы пользователя появятся здесь"
              icon={<CreditCard className="h-8 w-8" />}
            />
          ) : (
            <ul className="space-y-1 text-sm">
              {orders.map((o) => (
                <li key={o.id}>
                  {o.orderNumber ?? o.id} — {o.amount} ₽ — {o.status}
                  <span className="ml-2 text-xs text-[var(--portal-text-muted)]">
                    {o.paidAt
                      ? format(new Date(o.paidAt), 'dd.MM.yyyy')
                      : format(new Date(o.createdAt), 'dd.MM.yyyy')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {activeTab === 'tickets' && (
        <Card title="Тикеты">
          {tickets.length === 0 ? (
            <EmptyState
              className="py-8"
              title="Нет тикетов"
              description="Обращения в поддержку появятся здесь"
              icon={<MessageSquare className="h-8 w-8" />}
            />
          ) : (
            <ul className="space-y-1">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/portal/manager/tickets/${t.id}`} className="text-[var(--portal-accent)] hover:underline">
                    {t.subject}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--portal-text-muted)]">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

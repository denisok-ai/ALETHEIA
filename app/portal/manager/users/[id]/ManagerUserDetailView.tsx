'use client';

import Link from 'next/link';
import { User, BookOpen, Award, MessageSquare, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { gamificationSourceLabelRu } from '@/lib/gamification-source-labels';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { PortalBackLink } from '@/components/portal/PortalBackLink';
import { PORTAL_PATH } from '@/lib/portal-paths';

export type ManagerUserDetailViewProps = {
  displayName: string;
  email: string | null;
  profileRole: string | null;
  profileStatus: string | null;
  viewerRole: 'manager' | 'admin';
  enrollments: Array<{ id: string; courseId: string; courseTitle: string | null; enrolledAt: string }>;
  certificates: Array<{ id: string; courseId: string; courseTitle: string | null; certNumber: string }>;
  tickets: Array<{ id: string; subject: string; status: string }>;
  xpTotal: number;
  /** Уровень по суммарному XP (см. levelFromTotalXp). */
  levelDisplay: number;
  xpEvents: Array<{ id: string; createdAt: string; source: string; delta: number; balanceAfter: number }>;
  gamification: { xpLessonComplete: number; xpVerificationApproved: number };
};

export function ManagerUserDetailView({
  displayName,
  email,
  profileRole,
  profileStatus,
  viewerRole,
  enrollments,
  certificates,
  tickets,
  xpTotal,
  levelDisplay,
  xpEvents,
  gamification,
}: ManagerUserDetailViewProps) {
  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: PORTAL_PATH.managerDashboard, label: 'Дашборд' },
          { href: '/portal/manager/users', label: 'Пользователи' },
          { label: displayName },
        ]}
        title={displayName}
        description={email ?? undefined}
        actions={<PortalBackLink href="/portal/manager/users">К списку</PortalBackLink>}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <User className="h-4 w-4" aria-hidden />
            Профиль
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--portal-text-muted)] inline">Имя: </dt>
              <dd className="inline">{displayName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)] inline">Email: </dt>
              <dd className="inline">{email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)] inline">Роль: </dt>
              <dd className="inline">{profileRole ?? 'user'}</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)] inline">Статус: </dt>
              <dd className="inline">{profileStatus ?? 'active'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <BookOpen className="h-4 w-4" aria-hidden />
            Записи на курсы ({enrollments.length})
          </h2>
          {enrollments.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет записей</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <Link
                    href={`/portal/student/courses/${e.courseId}`}
                    className="text-[var(--portal-text)] hover:text-[var(--portal-accent)] hover:underline"
                  >
                    {e.courseTitle ?? e.courseId}
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
            <Award className="h-4 w-4" aria-hidden />
            Сертификаты ({certificates.length})
          </h2>
          {certificates.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет сертификатов</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {certificates.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/portal/student/courses/${c.courseId}`}
                    className="text-[var(--portal-text)] hover:text-[var(--portal-accent)] hover:underline"
                  >
                    {c.courseTitle ?? '—'}
                  </Link>
                  <span className="text-[var(--portal-text-muted)] ml-2">№{c.certNumber}</span>
                  {viewerRole === 'admin' && (
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

        <Card className="p-5 md:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-2">
            <Zap className="h-4 w-4" aria-hidden />
            Заряд (просмотр)
          </h2>
          <p className="text-xs text-[var(--portal-text-muted)] mb-3">
            Накопленный заряд и последние события. Полное редактирование — у администратора в карточке пользователя.
            Настройки приростов: «Геймификация» (урок +{gamification.xpLessonComplete}, верификация +
            {gamification.xpVerificationApproved}).
          </p>
          <dl className="flex flex-wrap gap-4 text-sm mb-4">
            <div>
              <dt className="text-[var(--portal-text-muted)]">Заряд</dt>
              <dd className="font-semibold">{xpTotal} ед.</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Уровень</dt>
              <dd className="font-semibold">{levelDisplay}</dd>
            </div>
          </dl>
          {xpEvents.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Событий заряда пока нет.</p>
          ) : (
            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC]">
              {xpEvents.map((ev) => (
                <li key={ev.id} className="flex flex-wrap gap-x-3 gap-y-0.5 justify-between">
                  <span className="text-[var(--portal-text-muted)] text-xs">
                    {new Date(ev.createdAt).toLocaleString('ru', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>{gamificationSourceLabelRu(ev.source)}</span>
                  <span className="tabular-nums">
                    {ev.delta > 0 ? `+${ev.delta}` : ev.delta} → {ev.balanceAfter}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--portal-text)] mb-4">
            <MessageSquare className="h-4 w-4" aria-hidden />
            Тикеты ({tickets.length})
          </h2>
          {tickets.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет обращений</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/portal/manager/tickets/${t.id}`}
                    className="text-[var(--portal-accent)] hover:underline font-medium"
                  >
                    {t.subject}
                  </Link>
                  <span
                    className={`ml-2 status-badge ${
                      t.status === 'open'
                        ? 'badge-warn'
                        : t.status === 'in_progress'
                          ? 'badge-info'
                          : 'badge-active'
                    }`}
                  >
                    {t.status === 'open'
                      ? 'Открыт'
                      : t.status === 'in_progress'
                        ? 'В работе'
                        : t.status === 'resolved'
                          ? 'Решён'
                          : 'Закрыт'}
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

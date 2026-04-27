'use client';

import Link from 'next/link';
import { BookOpen, FolderOpen, Users, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { PORTAL_PATH } from '@/lib/portal-paths';

const sections = [
  {
    href: '/portal/admin/courses',
    title: 'Группы курсов',
    description:
      'Дерево групп в разделе «Курсы». Фильтрация каталога по группе, вкладка «Группы» в карточке курса, массовое добавление и исключение курсов из групп.',
    icon: BookOpen,
  },
  {
    href: '/portal/admin/media',
    title: 'Группы медиатеки',
    description:
      'Дерево групп в разделе «Медиатека». Фильтрация по группе, блок «Группы ресурса» в диалоге редактирования, массовые действия.',
    icon: FolderOpen,
  },
  {
    href: '/portal/admin/users',
    title: 'Группы пользователей',
    description:
      'Дерево групп в разделе «Пользователи». Фильтрация по группе, вкладка «Группы» в карточке пользователя (роль участник/модератор), массовые действия.',
    icon: Users,
  },
];

export function AdminGroupsHubView() {
  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[{ href: PORTAL_PATH.adminDashboard, label: 'Дашборд' }, { label: 'Группы' }]}
        title="Группы"
        description="Иерархические группы для курсов, медиатеки и пользователей. Управление деревом и составом — в соответствующих разделах."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition hover:border-[var(--portal-accent)] hover:shadow-[var(--portal-shadow)]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h2 className="text-base font-semibold text-[var(--portal-text)]">{title}</h2>
                </div>
                <p className="flex-1 text-sm text-[var(--portal-text-muted)]">{description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--portal-accent)]">
                  Перейти в раздел
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

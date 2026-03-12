'use client';

/**
 * Блок быстрого доступа к разделам админки (UX: группировка по смыслу).
 */
import Link from 'next/link';
import {
  BookOpen,
  Users,
  Send,
  BarChart3,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/portal/Card';

const SECTIONS = [
  {
    title: 'Контент и обучение',
    description: 'Курсы, сертификаты, публикации, медиатека',
    href: '/portal/admin/courses',
    icon: BookOpen,
    links: [
      { label: 'Курсы', href: '/portal/admin/courses' },
      { label: 'Сертификаты', href: '/portal/admin/certificates' },
      { label: 'Публикации', href: '/portal/admin/publications' },
      { label: 'Медиатека', href: '/portal/admin/media' },
    ],
  },
  {
    title: 'Пользователи и продажи',
    description: 'Пользователи, CRM, оплаты',
    href: '/portal/admin/users',
    icon: Users,
    links: [
      { label: 'Пользователи', href: '/portal/admin/users' },
      { label: 'CRM', href: '/portal/admin/crm' },
      { label: 'Оплаты', href: '/portal/admin/payments' },
    ],
  },
  {
    title: 'Коммуникации',
    description: 'Рассылки, уведомления, шаблоны',
    href: '/portal/admin/mailings',
    icon: Send,
    links: [
      { label: 'Рассылки', href: '/portal/admin/mailings' },
      { label: 'Наборы уведомлений', href: '/portal/admin/notification-sets' },
      { label: 'Журнал уведомлений', href: '/portal/admin/notification-logs' },
    ],
  },
  {
    title: 'Аналитика и контроль',
    description: 'Отчётность, мониторинг, аудит',
    href: '/portal/admin/reports',
    icon: BarChart3,
    links: [
      { label: 'Отчётность', href: '/portal/admin/reports' },
      { label: 'Мониторинг', href: '/portal/admin/monitoring' },
      { label: 'Журнал аудита', href: '/portal/admin/audit' },
    ],
  },
  {
    title: 'Настройки',
    description: 'AI, общие настройки системы',
    href: '/portal/admin/settings',
    icon: Settings,
    links: [
      { label: 'Настройки AI', href: '/portal/admin/ai-settings' },
      { label: 'Настройки', href: '/portal/admin/settings' },
    ],
  },
] as const;

export function QuickAccessSection() {
  return (
    <section aria-labelledby="quick-access-heading">
      <h2 id="quick-access-heading" className="sr-only">
        Быстрый переход по разделам
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SECTIONS.map((block) => {
          const Icon = block.icon;
          return (
            <Card key={block.title} className="flex flex-col transition hover:border-[#6366F1]/40 hover:shadow-md">
              <Link
                href={block.href}
                className="flex flex-1 flex-col focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2 rounded-lg -m-1 p-1"
              >
                <div className="flex items-center gap-2 text-[#6366F1]">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="font-semibold text-[var(--portal-text)]">{block.title}</span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" aria-hidden />
                </div>
                <p className="mt-1.5 text-sm text-[var(--portal-text-muted)] line-clamp-2">{block.description}</p>
              </Link>
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#E2E8F0] pt-3 text-sm">
                {block.links.slice(0, 3).map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[#6366F1] hover:underline focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-1 rounded"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {block.links.length > 3 && (
                  <li>
                    <Link
                      href={block.href}
                      className="text-[var(--portal-text-muted)] hover:text-[#6366F1] text-xs"
                    >
                      ещё…
                    </Link>
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

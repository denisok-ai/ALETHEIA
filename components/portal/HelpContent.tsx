/**
 * Общий контент страницы «Помощь» в портале — единый стиль с эталоном.
 */
import Link from 'next/link';
import { Headphones, BookOpen, Mail, MessageCircle, Video } from 'lucide-react';

interface HelpContentProps {
  supportHref?: string;
  role?: 'student' | 'manager' | 'admin';
}

const iconCls = 'h-5 w-5 shrink-0 text-[var(--portal-accent)]';

const HELP_ITEMS: { id?: string; icon: typeof BookOpen; title: string; text: string }[] = [
  {
    icon: BookOpen,
    title: 'Курсы и доступ',
    text: 'Доступ после оплаты. Вход в ЛК под тем же email. «Мои курсы» — запуск и прогресс.',
  },
  {
    icon: Mail,
    title: 'Сброс пароля',
    text: 'По email недоступен. Обращайтесь к администратору или в поддержку.',
  },
  {
    icon: MessageCircle,
    title: 'Вопросы и обратная связь',
    text: 'Раздел «Поддержка» — создание обращения. Ответ на email регистрации.',
  },
  {
    id: 'verification',
    icon: Video,
    title: 'Как отправить задание на проверку',
    text: 'Страница курса → блок «Задания на проверку». Видео в YouTube/облако, вставьте ссылку. Статус — в меню «Задания на проверку».',
  },
];

export function HelpContent({ supportHref = '/portal/student/support', role = 'student' }: HelpContentProps) {
  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
        {HELP_ITEMS.map((item) => (
          <div
            key={item.title}
            id={item.id}
            className="portal-card flex gap-2.5 p-3 md:p-4 min-h-0 hover:shadow-[var(--portal-shadow)] transition-shadow scroll-mt-4"
          >
            <span className={iconCls} aria-hidden><item.icon className="h-full w-full" /></span>
            <div className="min-w-0">
              <p className="font-medium text-[var(--portal-text)] text-sm">{item.title}</p>
              <p className="mt-0.5 text-xs text-[var(--portal-text-muted)] leading-snug">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(role === 'student' || role === 'manager') && (
        <Link
          href={supportHref}
          className="portal-card flex flex-row items-center gap-3 p-3 md:p-4 block hover:shadow-[var(--portal-shadow)] transition-shadow w-full"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
            <Headphones className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-[var(--portal-text)]">
              {role === 'student' ? 'Поддержка' : 'Тикеты'}
            </p>
            <p className="text-xs text-[var(--portal-text-muted)]">
              {role === 'student' ? 'Обращения и история' : 'Обращения и тикеты'}
            </p>
          </div>
          <span className="text-xs text-[var(--portal-accent)] font-medium shrink-0">→</span>
        </Link>
      )}

      <p className="text-center text-xs text-[var(--portal-text-soft)] py-1">
        Админам: «Настройки» и <code className="rounded bg-[#F1F5F9] px-1">docs/</code>.
      </p>
    </div>
  );
}

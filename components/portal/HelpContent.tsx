'use client';

/**
 * Общий контент страницы «Помощь» в портале — единый стиль с эталоном.
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { Headphones, BookOpen, Mail, MessageCircle, Video, Sparkles, Bot } from 'lucide-react';

interface HelpContentProps {
  supportHref?: string;
  /** Роль в портале (не путать с ARIA role на DOM). */
  portalRole?: 'student' | 'manager' | 'admin';
}

const iconCls = 'h-5 w-5 shrink-0 text-[var(--portal-accent)]';

const linkInBody = 'font-medium text-[var(--portal-accent)] hover:underline';

const HELP_ITEMS: { id?: string; icon: typeof BookOpen; title: string; content: ReactNode }[] = [
  {
    icon: BookOpen,
    title: 'Курсы и доступ',
    content:
      'Доступ после оплаты. Вход в ЛК под тем же email. «Мои курсы» — запуск и прогресс.',
  },
  {
    id: 'ai-tutor',
    icon: Bot,
    title: 'AI-тьютор в плеере курса',
    content: (
      <>
        После «Начать курс» / «Продолжить» открывается полноэкранный плеер уроков (SCORM). Справа внизу — круглая кнопка с иконкой сообщения: чат{' '}
        <span className="text-[var(--portal-text)] font-medium">AI-тьютор</span>. Ответы строятся по материалам этого курса; если чего-то нет в уроках, тьютор подскажет обратиться к куратору. Если кнопки нет — для курса тьютор отключён школой. Вопросы по оплате и доступу — в разделе «Поддержка».
      </>
    ),
  },
  {
    icon: Mail,
    title: 'Сброс пароля',
    content: 'По email недоступен. Обращайтесь к администратору или в поддержку.',
  },
  {
    icon: MessageCircle,
    title: 'Вопросы и обратная связь',
    content: 'Раздел «Поддержка» — создание обращения. Ответ на email регистрации.',
  },
  {
    id: 'verification',
    icon: Video,
    title: 'Как отправить задание на проверку',
    content: (
      <>
        На странице курса откройте блок «Задания на проверку» или раздел{' '}
        <Link href="/portal/student/verifications" className={linkInBody}>
          Задания на проверку
        </Link>
        : запишите видео или вставьте ссылку (YouTube, облако) либо загрузите файл MP4/WebM до 200 МБ. Текстовый ответ — там же. После одобрения менеджером к заряду на дашборде начисляется бонус (подробности в{' '}
        <Link href="/portal/student/gamification" className={linkInBody}>
          История заряда
        </Link>
        ). Комментарий при отклонении виден в списке отправок.
      </>
    ),
  },
  {
    id: 'gamification',
    icon: Sparkles,
    title: 'Уровни заряда на дашборде',
    content: (
      <>
        Заряд — шкала «батарейки» на дашборде: за первое завершение урока в SCORM и за одобренное практическое задание (верификация) начисляется прирост; повтор по тому же уроку не дублирует заряд. Порог бейджа («Новичок», «Практик»…) — подсказка «+N к уровню заряда». Числа уровней задаёт администратор в настройках школы. Список ваших начислений:{' '}
        <Link href="/portal/student/gamification" className={linkInBody}>
          История заряда
        </Link>{' '}
        в меню слева.
      </>
    ),
  },
];

/** Next.js при клиентском переходе по ссылке с #якорем часто не прокручивает к блоку — делаем вручную. */
function useScrollToHelpHash() {
  useEffect(() => {
    const scrollToId = () => {
      const id = window.location.hash.replace(/^#/, '').trim();
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      });
    };

    scrollToId();
    window.addEventListener('hashchange', scrollToId);
    return () => window.removeEventListener('hashchange', scrollToId);
  }, []);
}

export function HelpContent({ supportHref = '/portal/student/support', portalRole = 'student' }: HelpContentProps) {
  useScrollToHelpHash();

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
              <div className="mt-0.5 text-xs text-[var(--portal-text-muted)] leading-snug">{item.content}</div>
            </div>
          </div>
        ))}
      </div>

      {portalRole === 'admin' && (
        <div className="space-y-4">
          <div className="portal-card flex gap-2.5 p-3 md:p-4 border border-[var(--portal-accent-muted)]/40">
            <span className={iconCls} aria-hidden>
              <Sparkles className="h-full w-full" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-[var(--portal-text)] text-sm">Геймификация и заряд пользователей</p>
              <p className="mt-0.5 text-xs text-[var(--portal-text-muted)] leading-snug">
                Глобальные параметры (шаг уровня заряда, прирост за первое завершение урока): раздел{' '}
                <Link href="/portal/admin/gamification" className="font-medium text-[var(--portal-accent)] hover:underline">
                  Настройки → Геймификация
                </Link>{' '}
                (<code className="rounded bg-[#F1F5F9] px-1">/portal/admin/gamification</code>) или ⌘K / Ctrl+K → «Геймификация».
                Ручное начисление или списание заряда:{' '}
                <Link href="/portal/admin/users" className="font-medium text-[var(--portal-accent)] hover:underline">
                  Пользователи
                </Link>
                {' — карточка пользователя → вкладка «Уровень заряда» (заряд, события, ручная правка).'}
                {' Свои начисления под этим же входом: '}
                <Link href="/portal/student/gamification" className="font-medium text-[var(--portal-accent)] hover:underline">
                  ЛК студента → История заряда
                </Link>
                .
              </p>
            </div>
          </div>

          <div
            id="ai-tutor-admin"
            className="portal-card flex gap-2.5 p-3 md:p-4 border border-[var(--portal-accent-muted)]/40 scroll-mt-4"
          >
            <span className={iconCls} aria-hidden>
              <Bot className="h-full w-full" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-[var(--portal-text)] text-sm">AI-тьютор: настройка и беседы</p>
              <p className="mt-0.5 text-xs text-[var(--portal-text-muted)] leading-snug">
                Модель, ключи, playbook и шаблоны промпта для тьютора:{' '}
                <Link href="/portal/admin/ai-settings" className="font-medium text-[var(--portal-accent)] hover:underline">
                  Настройки AI
                </Link>
                . Включение чата в плеере — по каждому курсу:{' '}
                <Link href="/portal/admin/courses" className="font-medium text-[var(--portal-accent)] hover:underline">
                  Курсы
                </Link>
                {' → карточка курса → блок «AI-тьютор в плеере» (переключатель и таблица бесед студентов с просмотром переписки).'}
              </p>
            </div>
          </div>
        </div>
      )}

      {(portalRole === 'student' || portalRole === 'manager') && (
        <Link
          href={supportHref}
          className="portal-card flex flex-row items-center gap-3 p-3 md:p-4 block hover:shadow-[var(--portal-shadow)] transition-shadow w-full"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
            <Headphones className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-[var(--portal-text)]">
              {portalRole === 'student' ? 'Поддержка' : 'Тикеты'}
            </p>
            <p className="text-xs text-[var(--portal-text-muted)]">
              {portalRole === 'student' ? 'Обращения и история' : 'Обращения и тикеты'}
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

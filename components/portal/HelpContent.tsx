/**
 * Общий контент страницы «Помощь» в портале — единый стиль с эталоном.
 */
import Link from 'next/link';
import { Headphones, BookOpen, Mail, MessageCircle } from 'lucide-react';

interface HelpContentProps {
  supportHref?: string;
  role?: 'student' | 'manager' | 'admin';
}

const iconCls = 'h-5 w-5 shrink-0 text-[#4F46E5]';

export function HelpContent({ supportHref = '/portal/student/support', role = 'student' }: HelpContentProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-4">Помощь и поддержка</h2>
        <p className="text-sm text-[var(--portal-text-muted)] mb-5">Частые вопросы и контакты</p>
        <div className="space-y-5">
          <div className="flex gap-3">
            <span className={iconCls} aria-hidden><BookOpen className="h-full w-full" /></span>
            <div>
              <p className="font-medium text-[var(--portal-text)]">Курсы и доступ</p>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                Доступ к курсам открывается после оплаты. Войдите в личный кабинет под тем же email, что при оплате. Раздел «Мои курсы» — запуск материалов и отслеживание прогресса.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className={iconCls} aria-hidden><Mail className="h-full w-full" /></span>
            <div>
              <p className="font-medium text-[var(--portal-text)]">Сброс пароля</p>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                Сброс пароля по email в текущей версии недоступен. Обратитесь к администратору или в поддержку.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className={iconCls} aria-hidden><MessageCircle className="h-full w-full" /></span>
            <div>
              <p className="font-medium text-[var(--portal-text)]">Вопросы и обратная связь</p>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                Используйте раздел «Поддержка» для создания обращения. Ответ придёт на email, указанный при регистрации.
              </p>
            </div>
          </div>
        </div>
      </div>

      {(role === 'student' || role === 'manager') && (
        <Link
          href={supportHref}
          className="portal-card flex items-center gap-4 p-5 block hover:shadow-[var(--portal-shadow)] transition-shadow"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
            <Headphones className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--portal-text)]">
              {role === 'student' ? 'Поддержка' : 'Тикеты'}
            </p>
            <p className="text-sm text-[var(--portal-text-muted)] mt-0.5">
              {role === 'student'
                ? 'Создать обращение или посмотреть историю тикетов'
                : 'Список обращений и работа с тикетами'}
            </p>
          </div>
          <span className="text-sm text-[#6366F1] font-medium shrink-0">Перейти →</span>
        </Link>
      )}

      <p className="text-center text-xs text-[var(--portal-text-soft)]">
        Документация для администраторов: раздел «Настройки» и файлы в <code className="rounded bg-[#F1F5F9] px-1.5 py-0.5">docs/</code> проекта.
      </p>
    </div>
  );
}

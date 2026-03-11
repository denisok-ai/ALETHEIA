/**
 * Общий контент страницы «Помощь» в портале.
 */
import Link from 'next/link';
import { Card } from '@/components/portal/Card';
import { Headphones, BookOpen, Mail, MessageCircle } from 'lucide-react';

interface HelpContentProps {
  /** Ссылка на раздел поддержки (тикеты) — для студента */
  supportHref?: string;
  /** Роль для адаптации текста */
  role?: 'student' | 'manager' | 'admin';
}

export function HelpContent({ supportHref = '/portal/student/support', role = 'student' }: HelpContentProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card title="Помощь и поддержка" description="Частые вопросы и контакты">
        <div className="space-y-4 text-sm text-dark">
          <div className="flex gap-3">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Курсы и доступ</p>
              <p className="mt-1 text-text-muted">
                Доступ к курсам открывается после оплаты. Войдите в личный кабинет под тем же email, который указывали при оплате. Раздел «Мои курсы» — запуск материалов и отслеживание прогресса.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Сброс пароля</p>
              <p className="mt-1 text-text-muted">
                В текущей версии сброс пароля по email недоступен. Обратитесь к администратору или в поддержку для восстановления доступа.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Технические вопросы и обратная связь</p>
              <p className="mt-1 text-text-muted">
                Используйте раздел «Поддержка» для создания обращения. Мы ответим на указанный при регистрации email.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {(role === 'student' || role === 'manager') && (
        <Card>
          <Link
            href={supportHref}
            className="flex items-center gap-3 rounded-lg border border-border bg-bg-soft p-4 text-dark transition hover:border-primary hover:bg-lavender-light"
          >
            <Headphones className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <p className="font-semibold">{role === 'student' ? 'Поддержка' : 'Тикеты'}</p>
              <p className="text-sm text-text-muted">
                {role === 'student'
                  ? 'Создать обращение или посмотреть историю тикетов'
                  : 'Список обращений и работа с тикетами'}
              </p>
            </div>
          </Link>
        </Card>
      )}

      <p className="text-center text-xs text-text-muted">
        Документация для администраторов: раздел «Настройки» в админ-панели и файлы в <code className="rounded bg-bg-soft px-1">docs/</code> проекта.
      </p>
    </div>
  );
}

'use client';

/**
 * Клиентский компонент: стили кнопок через buttonVariants из `@/components/ui/button` (там «use client»).
 * Иначе Next вызывает cva с сервера и падает с ошибкой RSC.
 */
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Кастомная 404 для публичного сайта (портал использует свои страницы). Мета-теги — из корневого layout. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[min(70dvh,600px)] max-w-lg flex-col items-center justify-center px-4 pb-20 pt-24 text-center font-body">
      <FileQuestion className="h-16 w-16 text-plum/80" aria-hidden />
      <h1 className="mt-6 font-heading text-2xl font-semibold text-[var(--text)] sm:text-3xl">Страница не найдена</h1>
      <p className="mt-3 text-[var(--text-muted)] leading-relaxed">
        Такой страницы нет или ссылка устарела. Перейдите на главную или воспользуйтесь меню.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/" className={cn(buttonVariants({ variant: 'landingRose', size: 'lg' }), 'rounded-xl')}>
          На главную
        </Link>
        <Link
          href="/course/navyki-myshechnogo-testirovaniya"
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'lg' }),
            'rounded-xl border border-plum/40 bg-transparent text-plum hover:bg-plum/10'
          )}
        >
          Курс
        </Link>
        <Link
          href="/blog"
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'lg' }),
            'rounded-xl border border-plum/40 bg-transparent text-plum hover:bg-plum/10'
          )}
        >
          Блог
        </Link>
      </div>
    </main>
  );
}

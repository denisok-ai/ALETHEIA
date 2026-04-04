'use client';

import Link from 'next/link';
import { Gift, Sparkles } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { CourseModulesAccordion, type CourseModuleItem } from '@/components/CourseModulesAccordion';

export type BlogHighlight = { slug: string; title: string; description: string };

type Props = {
  courseIntro: { lead: string; bonuses: string };
  courseModules: CourseModuleItem[];
  blogHighlights: BlogHighlight[];
};

export function CourseNavykiMarketingArticle({ courseIntro, courseModules, blogHighlights }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
      <Breadcrumbs
        items={[
          { label: 'Главная', href: '/' },
          { label: 'Навыки мышечного тестирования' },
        ]}
      />

      <article>
        <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
          Курс «Навыки мышечного тестирования»
        </h1>
        <p className="mt-6 leading-[var(--leading-body)] text-[var(--text-muted)]">{courseIntro.lead}</p>

        <section className="mt-8 rounded-2xl border border-rose/30 bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex items-start gap-3">
            <Gift className="h-6 w-6 shrink-0 text-rose" aria-hidden />
            <div>
              <h2 className="font-heading text-lg font-semibold text-[var(--text)]">Бонусы и доступ</h2>
              <p className="mt-2 text-[var(--text-muted)]">{courseIntro.bonuses}</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center gap-2 text-plum">
            <Sparkles className="h-6 w-6" aria-hidden />
            <h2 className="font-heading text-2xl font-semibold text-[var(--text)]">Программа (тизер)</h2>
          </div>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            Ниже — обзор модулей в интригующем формате. Полные протоколы и живые разборы — внутри платного курса.
          </p>
          <CourseModulesAccordion modules={courseModules} />
        </section>

        {blogHighlights.length > 0 ? (
          <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--lavender-light)] p-6 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-[var(--text)]">По теме в блоге</h2>
            <ul className="mt-4 space-y-3 text-[var(--text-muted)]">
              {blogHighlights.map((post) => (
                <li key={post.slug}>
                  <Link href={`/blog/${post.slug}`} className="text-plum hover:underline">
                    {post.title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">{post.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10">
          <CourseCheckoutCTA
            title="Что, если прямо сейчас ваше тело пытается сказать вам что-то важное?"
            subtitle="Оформление и доступ — на платформе школы. Один клик — и вы в программе."
          />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-[var(--text-soft)]">
          Все техники курса рассчитаны на ресурсное состояние и этичную подачу. Не является медицинской услугой. При
          наличии диагнозов консультируйтесь с врачом.
        </p>
      </article>
    </main>
  );
}

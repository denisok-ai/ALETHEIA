import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, Sparkles } from 'lucide-react';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { JsonLdCoursePage } from '@/components/JsonLdCoursePage';
import { CourseModulesAccordion } from '@/components/CourseModulesAccordion';
import { courseIntro, courseModules, COURSE_SLUG } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

const DESCRIPTION =
  'Практический 2-месячный курс: научитесь находить скрытые источники стресса и разговаривать с телом без слов. 6 живых занятий с куратором.';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${COURSE_SLUG}`;
  const canonical = `${base}${path}`;
  const title = 'Курс Навыки мышечного тестирования | АВАТЕРРА';

  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: canonical,
      type: 'website',
      locale: 'ru_RU',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: DESCRIPTION,
    },
    robots: { index: true, follow: true },
  };
}

export default async function CourseNavykiPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${COURSE_SLUG}`;
  const pageUrl = `${base}${path}`;

  return (
    <>
      <JsonLdCoursePage
        name="Навыки мышечного тестирования"
        description={DESCRIPTION}
        pageUrl={pageUrl}
      />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <nav className="mb-6 text-sm text-[var(--text-muted)]">
          <Link href="/" className="hover:text-plum">
            Главная
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span className="text-[var(--text)]">Курс</span>
        </nav>

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
    </>
  );
}

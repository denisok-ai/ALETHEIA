import type { Metadata } from 'next';
import { AnalyticsCourseView } from '@/components/AnalyticsCourseView';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdCoursePage } from '@/components/JsonLdCoursePage';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LandingHero } from '@/components/course-landing/LandingHero';
import { LandingSection } from '@/components/course-landing/LandingSection';
import { AudienceBlocks } from '@/components/course-landing/PainBlocks';
import { ResultsGrid } from '@/components/course-landing/ResultsGrid';
import { ModulesAccordionRich } from '@/components/course-landing/ModulesAccordionRich';
import { TestimonialsCompact } from '@/components/course-landing/TestimonialsCompact';
import { AuthorMiniBlock } from '@/components/course-landing/AuthorMiniBlock';
import { FaqBlock } from '@/components/course-landing/FaqBlock';
import { FinalCTA } from '@/components/course-landing/FinalCTA';
import { COURSE_SLUG } from '@/lib/content/course-lynda-teaser';
import {
  MT_AUDIENCES,
  MT_BONUSES,
  MT_FAQ,
  MT_FORMAT_FACTS,
  MT_FORMAT_FEATURES,
  MT_HERO,
  MT_MODULES,
  MT_RESULTS,
  MT_TESTIMONIALS,
} from '@/lib/content/course-mt-landing';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { Gift, Sparkles } from 'lucide-react';

const DESCRIPTION =
  'Курс «Навыки мышечного тестирования»: научитесь находить причины проблем за 5–15 минут. 6 живых занятий с куратором + 2 с автором. Доступ 3 месяца.';
const OG_IMAGE_PATH = '/images/tatiana/tatiana-hero.png' as const;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${COURSE_SLUG}`;
  const canonical = `${base}${path}`;
  const title = 'Курс мышечного тестирования онлайн | Школа АВАТЕРРА';
  const ogImageAbs = `${base}${OG_IMAGE_PATH}`;
  return {
    title,
    description: DESCRIPTION,
    keywords: [
      'мышечное тестирование',
      'кинезиология онлайн',
      'курс по телесной терапии',
      'Татьяна Стрельцова',
      'работа с подсознанием',
      'психосоматика',
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: canonical,
      type: 'website',
      locale: 'ru_RU',
      siteName: 'АВАТЕРРА',
      images: [{ url: ogImageAbs, width: 1024, height: 1280, alt: 'Курс мышечного тестирования — школа АВАТЕРРА' }],
    },
    twitter: { card: 'summary_large_image', title, description: DESCRIPTION, images: [ogImageAbs] },
    robots: { index: true, follow: true },
  };
}

export default async function CourseNavykiPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/course/${COURSE_SLUG}`;

  const courseTitle = 'Навыки мышечного тестирования и работа с подсознанием';

  return (
    <>
      <AnalyticsCourseView />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: `Курс «${courseTitle}»`, url: pageUrl },
        ]}
      />
      <JsonLdCoursePage name={courseTitle} description={DESCRIPTION} pageUrl={pageUrl} />

      <div className="bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-4 pt-20 md:px-8 md:pt-22">
          <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Курс мышечного тестирования' }]} />
        </div>

        <LandingHero
          eyebrow={MT_HERO.eyebrow}
          title={MT_HERO.title}
          subtitle={MT_HERO.subtitle}
          description={MT_HERO.description}
          badges={MT_HERO.badges}
          trust={MT_HERO.trust}
          imageSrc="/images/tatiana/tatiana-hero.png"
          imageAlt="Татьяна Стрельцова — основательница школы кинезиологии АВАТЕРРА"
          ctaPrimary={{ label: 'Выбрать тариф', href: '/#pricing' }}
          ctaSecondary={{ label: 'Программа курса', href: '#program' }}
        />

        <LandingSection
          id="audience"
          eyebrow="Для кого этот курс"
          title="Этот курс — для вас, если…"
          description="Программа подходит и тем, кто только знакомится с методом, и практикам с опытом — каждому свой формат пользы."
          tone="surface"
        >
          <AudienceBlocks items={MT_AUDIENCES} />
        </LandingSection>

        <LandingSection
          id="format"
          eyebrow="Что внутри"
          title="Формат и доступ к материалам"
          description="Видео, тексты, аудио-практики и живые встречи — баланс самостоятельной работы и обратной связи от мастеров."
          tone="lavender"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MT_FORMAT_FACTS.map((f) => (
              <div
                key={f.label}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-soft)]"
              >
                <p className="font-heading text-2xl font-semibold text-plum sm:text-3xl">{f.value}</p>
                <p className="mt-1 text-sm leading-snug text-[var(--text-muted)]">{f.label}</p>
              </div>
            ))}
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {MT_FORMAT_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]"
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-plum" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </LandingSection>

        <LandingSection
          id="program"
          eyebrow="Программа курса"
          title="6 модулей: от первой связи с телом до устойчивого результата"
          description="Каждый модуль — короткие видео, чек-листы, аудио-практика и живой разбор с куратором."
          tone="bg"
        >
          <ModulesAccordionRich modules={MT_MODULES} />
        </LandingSection>

        <LandingSection
          id="results"
          eyebrow="После курса"
          title="Что у вас останется после программы"
          description="Не временный «вау-эффект», а устойчивый навык, который останется с вами навсегда."
          tone="surface"
        >
          <ResultsGrid items={MT_RESULTS} />
        </LandingSection>

        <LandingSection
          id="author"
          eyebrow="Автор курса"
          title="Татьяна Стрельцова"
          tone="lavender"
        >
          <AuthorMiniBlock
            name="Татьяна Стрельцова"
            roleLabel="Основательница школы AVATERRA"
            quote="Мы не лечим — мы убираем стресс. Тело помнит всё. Наша задача — помочь ему «отпустить» то, что больше не служит."
            facts={[
              '22 года практики в области кинезиологии и работы с подсознанием',
              '15 000+ выпускников из 23 стран',
              'Автор интеграции: мышечное тестирование + Карта Эмоций + Регресс',
              'Живые сессии и ответы на вопросы студентов на каждом потоке',
            ]}
          />
        </LandingSection>

        <LandingSection
          id="reviews"
          eyebrow="Отзывы"
          title="Истории тех, кто прошёл курс"
          tone="bg"
        >
          <TestimonialsCompact
            items={MT_TESTIMONIALS.map((t) => ({
              text: t.text,
              author: t.author,
              meta: t.meta,
              rating: 5,
            }))}
          />
        </LandingSection>

        <LandingSection
          id="bonuses"
          eyebrow="Бонусы и гарантия"
          title="Что вы получаете в подарок"
          description="Подарки и поддержка — чтобы первые шаги были мягкими, а результат — устойчивым."
          tone="surface"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {MT_BONUSES.map((b) => (
              <div
                key={b.title}
                className="flex h-full flex-col rounded-2xl border border-rose/30 bg-[var(--lavender-light)] p-6 shadow-[var(--shadow-soft)]"
              >
                <Gift className="mb-3 h-7 w-7 text-rose" aria-hidden />
                <h3 className="font-heading text-lg font-semibold text-[var(--text)]">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{b.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm leading-relaxed text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">Гарантия 7 дней.</span> Если в первую неделю вы поймёте, что курс не ваш — напишите в поддержку, и мы вернём деньги без вопросов и бюрократии.
          </p>
        </LandingSection>

        <LandingSection id="faq" eyebrow="Частые вопросы" title="Что обычно спрашивают перед стартом" tone="bg">
          <FaqBlock items={MT_FAQ} />
        </LandingSection>

        <FinalCTA
          title="Готовы начать диалог с вашим телом?"
          subtitle="Присоединяйтесь к тем, кто уже научился находить причины и снимать напряжение — без таблеток и долгих поисков."
          ctaPrimary={{ label: 'Выбрать тариф и начать', href: '/#pricing' }}
          ctaSecondary={{ label: 'Читать блог о методе', href: '/blog' }}
          disclaimer="Курс не является медицинской услугой. При наличии диагнозов консультируйтесь с врачом. Все техники рассчитаны на ресурсное состояние и этичную подачу."
        />
      </div>
    </>
  );
}

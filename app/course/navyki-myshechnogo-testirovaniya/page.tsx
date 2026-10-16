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
import { WaitlistForm } from '@/components/course-landing/WaitlistForm';
import { COURSE_SLUG } from '@/lib/content/course-lynda-teaser';
import {
  MT_AUDIENCES,
  MT_BONUSES,
  MT_FAQ,
  MT_FIT,
  MT_FORMAT_FACTS,
  MT_FORMAT_FEATURES,
  MT_HERO,
  MT_MODULES,
  MT_NOT_FIT,
  MT_PRODUCT_NAME,
  MT_PRODUCT_SLUG,
  MT_RESULTS,
  MT_TESTIMONIALS,
} from '@/lib/content/course-mt-landing';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublicProducts } from '@/lib/shop/public-products';
import { Check, Gift, Sparkles, X } from 'lucide-react';

const PAGE_TITLE = 'Тело знает всё — практикум мышечного тестирования';
const DESCRIPTION =
  'Практикум «Тело знает всё»: мышечное тестирование для самостоятельного освоения. 6 модулей, доступ 3 месяца, в своём темпе. Без кураторов и живых занятий.';
const OG_IMAGE_PATH = '/images/og/og-default.png' as const;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${COURSE_SLUG}`;
  const canonical = `${base}${path}`;
  // Бренд добавляет шаблон в layout — вручную не дублируем
  const title = PAGE_TITLE;
  const ogImageAbs = `${base}${OG_IMAGE_PATH}`;
  return {
    title,
    description: DESCRIPTION,
    keywords: [
      'мышечное тестирование',
      'кинезиология онлайн',
      'обучение кинезиологии онлайн',
      'практикум мышечного тестирования',
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
      images: [{ url: ogImageAbs, width: 1200, height: 630, alt: 'Тело знает всё — практикум школы АВАТЕРРА' }],
    },
    twitter: { card: 'summary_large_image', title, description: DESCRIPTION, images: [ogImageAbs] },
    robots: { index: true, follow: true },
  };
}

export default async function CourseNavykiPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/course/${COURSE_SLUG}`;

  const courseTitle = MT_PRODUCT_NAME;
  const buyHref = `/services/${MT_PRODUCT_SLUG}`;

  // Цена практикума — из БД (товар telo-znaet-vse) для Offer в schema.org Course
  const practicum = (await getPublicProducts()).find((p) => p.slug === MT_PRODUCT_SLUG);
  const priceRange = practicum ? { low: practicum.price, high: practicum.price } : undefined;

  return (
    <>
      <AnalyticsCourseView />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: courseTitle, url: pageUrl },
        ]}
      />
      <JsonLdCoursePage
        name={courseTitle}
        description={DESCRIPTION}
        pageUrl={pageUrl}
        priceRange={priceRange}
        courseWorkload="PT6H"
      />

      <div className="bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-4 pt-20 md:px-8 md:pt-22">
          <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Тело знает всё' }]} />
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
          ctaPrimary={{ label: 'Начать практикум', href: buyHref }}
          ctaSecondary={{ label: 'Программа практикума', href: '#program' }}
        />

        <LandingSection
          id="audience"
          eyebrow="Для кого этот практикум"
          title="Практикум — для вас, если…"
          description="Подходит и тем, кто только знакомится с подходом, и практикам с опытом — каждому свой формат пользы."
          tone="surface"
        >
          <AudienceBlocks items={MT_AUDIENCES} />
        </LandingSection>

        <LandingSection
          id="fit"
          eyebrow="Формат"
          title="Кому подойдёт самостоятельный формат, а кому — нет"
          description="Честно о том, что входит в практикум и что не входит."
          tone="bg"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <h3 className="font-heading text-lg font-semibold text-[var(--text)]">Практикум подойдёт, если</h3>
              <ul className="mt-4 space-y-3">
                {MT_FIT.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--text)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-plum" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <h3 className="font-heading text-lg font-semibold text-[var(--text)]">Практикум не подойдёт, если</h3>
              <ul className="mt-4 space-y-3">
                {MT_NOT_FIT.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </LandingSection>

        <LandingSection
          id="format"
          eyebrow="Что внутри"
          title="Формат и доступ к материалам"
          description="Видео, тексты, чек-листы и аудиопрактики — всё, чтобы освоить подход самостоятельно, в своём темпе."
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
          eyebrow="Программа практикума"
          title="6 модулей: от первой связи с телом до устойчивого результата"
          description="Каждый модуль — короткие видео, тексты, чек-листы и аудиопрактика. Вопросы по материалам задайте помощнику в личном кабинете."
          tone="bg"
        >
          <ModulesAccordionRich modules={MT_MODULES} />
        </LandingSection>

        <LandingSection
          id="results"
          eyebrow="После практикума"
          title="Что у вас останется после программы"
          description="Не временный «вау-эффект», а устойчивый навык, который останется с вами."
          tone="surface"
        >
          <ResultsGrid items={MT_RESULTS} />
        </LandingSection>

        <LandingSection
          id="author"
          eyebrow="Автор практикума"
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
              'Личная работа с мастером — по листу ожидания, без обязательств',
            ]}
          />
        </LandingSection>

        <LandingSection
          id="reviews"
          eyebrow="Отзывы"
          title="Истории тех, кто прошёл практикум"
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
          eyebrow="Материалы"
          title="Что входит в подарок к практикуму"
          description="Дополнительные материалы — для мягкого старта и закрепления результата."
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
            <span className="font-semibold text-[var(--text)]">Перед покупкой.</span> Можно начать с бесплатного знакомства «Первый тест» и посмотреть полную программу. Доступ к материалам открывается сразу после оплаты на 3 месяца; возврат предусмотрен, если доступ не был предоставлен по вине школы — условия в <a href="/oferta#vozvrat" className="font-medium text-plum underline hover:opacity-90">публичной оферте</a>.
          </p>
        </LandingSection>

        <LandingSection id="faq" eyebrow="Частые вопросы" title="Что обычно спрашивают перед стартом" tone="bg">
          <FaqBlock items={MT_FAQ} />
        </LandingSection>

        <LandingSection
          id="waitlist"
          eyebrow="Личная работа с мастером"
          title="Хочу личную работу с мастером"
          description="Личная работа с Татьяной Стрельцовой открывается отдельными потоками. Запишитесь в лист ожидания — мы свяжемся, когда появится запись."
          tone="lavender"
        >
          <WaitlistForm />
        </LandingSection>

        <FinalCTA
          title="Готовы начать диалог с вашим телом?"
          subtitle="Начните самостоятельный практикум: 6 модулей, доступ 3 месяца, в своём темпе."
          ctaPrimary={{ label: 'Начать практикум', href: buyHref }}
          ctaSecondary={{ label: 'Хочу личную работу с мастером', href: '#waitlist' }}
          supportLabel="Помощник в личном кабинете"
          disclaimer="Практикум не является медицинской услугой и не заменяет врача. При наличии диагнозов консультируйтесь с врачом. Все техники рассчитаны на ресурсное состояние и этичную подачу."
        />
      </div>
    </>
  );
}

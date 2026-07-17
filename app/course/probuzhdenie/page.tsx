import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { AnalyticsCourseView } from '@/components/AnalyticsCourseView';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdCoursePage } from '@/components/JsonLdCoursePage';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProbuzhdenieDarkInterlude } from '@/components/course-landing/ProbuzhdenieDarkInterlude';
import { ProbuzhdenieZigzagRow } from '@/components/course-landing/ProbuzhdenieZigzagRow';
import { AuthorMiniBlock } from '@/components/course-landing/AuthorMiniBlock';
import { TariffsBlock } from '@/components/course-landing/TariffsBlock';
import { FaqBlock } from '@/components/course-landing/FaqBlock';
import { FinalCTA } from '@/components/course-landing/FinalCTA';
import { LandingSection } from '@/components/course-landing/LandingSection';
import {
  BERLINSKA_COURSE_KEY,
  BERLINSKA_PAINS,
  BERLINSKA_WEEKS,
  BERLINSKA_WHAT_DO,
  BERLINSKA_WHY,
  PROBUZHDENIE_BERLINSKA_SLUG,
  type ProbuzhdenieVisualBlock,
} from '@/lib/content/course-probuzhdenie-berlinska';
import {
  PROB_FAQ,
  PROB_GROUP_TARIFF_IMAGE,
  PROB_TARIFFS,
} from '@/lib/content/course-probuzhdenie';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

const DESCRIPTION =
  'Курс «Пробуждение» — 21 день практик осознанности: выход из стресса и автопилота, поддержка в чате и живые разборы с Татьяной Стрельцовой.';
const OG_IMAGE_PATH = '/images/probuzhdenie/hero-berlinska-key.png' as const;

const ZIGZAG_TAIL: ProbuzhdenieVisualBlock[] = [BERLINSKA_WHY, BERLINSKA_WHAT_DO, BERLINSKA_COURSE_KEY, ...BERLINSKA_WEEKS];

/** Сторона фото у рядов **с иллюстрацией** (как на проде: первый блок — фото справа). */
function imageOnLeftForImageRow(imageRowIndex: number, block: ProbuzhdenieVisualBlock): boolean {
  if (block.imageOnLeftOverride !== undefined) return block.imageOnLeftOverride;
  return imageRowIndex % 2 === 1;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${PROBUZHDENIE_BERLINSKA_SLUG}`;
  const canonical = `${base}${path}`;
  const title = 'Курс «Пробуждение» — 21 день практики с телом | АВАТЕРРА';
  const ogImageAbs = `${base}${OG_IMAGE_PATH}`;
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
      siteName: 'АВАТЕРРА',
      images: [{ url: ogImageAbs, width: 1200, height: 800, alt: 'Курс «Пробуждение»' }],
    },
    twitter: { card: 'summary_large_image', title, description: DESCRIPTION, images: [ogImageAbs] },
    robots: { index: true, follow: true },
  };
}

export default async function ProbuzhdeniePage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/course/${PROBUZHDENIE_BERLINSKA_SLUG}`;
  /** Индекс только среди секций с фото (omit-секции не сдвигают зигзаг). */
  let imageRowIndex = 0;

  return (
    <>
      <AnalyticsCourseView />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Курс «Пробуждение»', url: pageUrl },
        ]}
      />
      <JsonLdCoursePage
        name="Курс «Пробуждение»"
        description={DESCRIPTION}
        pageUrl={pageUrl}
        priceRange={{ low: 22_000, high: 44_000 }}
      />

      <div className="bg-[var(--bg)] text-[var(--text)]">
        {/* Герой: светлая зона — как на прод-лендинге зигзага */}
        <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--lavender-light)] px-4 pb-12 pt-6 md:px-8 md:pb-16">
          <div
            className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-plum/[0.12] blur-3xl md:-right-16"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className="lg:col-span-7">
              <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Курс «Пробуждение»' }]} />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-plum">
                Курс практик Татьяны Стрельцовой
              </p>
              <h1 className="mt-4 max-w-4xl font-heading text-4xl font-bold leading-[1.08] text-[var(--text)] sm:text-5xl md:text-6xl">
                ПРОБУЖДЕНИЕ
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-muted)] md:text-xl">
                Практики осознанности: активация пробуждения.{' '}
                <span className="text-[var(--text)]">21 день.</span> Выход из состояния автопилота. И контакт с силой духа.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#tariffs"
                  className={cn(buttonVariants({ size: 'lg' }), 'rounded-full bg-plum px-8 text-white hover:bg-plum/90')}
                >
                  Записаться на курс
                </Link>
                <Link
                  href="#week-1"
                  className={cn(
                    buttonVariants({ variant: 'landingSoft', size: 'lg' }),
                    'rounded-full border-2 border-plum/30 bg-white/90 text-[var(--text)] shadow-sm hover:bg-white',
                  )}
                >
                  Программа
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[min(100%,360px)] lg:col-span-5 lg:mx-0 sm:max-w-[400px] lg:max-w-none">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-periwinkle/50 bg-white shadow-[var(--shadow-card)]">
                <Image
                  src="/images/probuzhdenie/hero-berlinska-key.png"
                  alt="Образ курса «Пробуждение» — ключ, священная книга и свет"
                  fill
                  unoptimized
                  className="object-cover object-center"
                  sizes="(min-width: 1024px) 400px, 90vw"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <div className="relative overflow-hidden bg-[linear-gradient(180deg,#07142b_0%,#0a1f3f_32%,#213a63_44%,rgba(232,225,241,0.88)_56%,var(--lavender-light)_78%,var(--surface)_100%)]">
          <div
            className="pointer-events-none absolute -left-28 top-24 h-80 w-80 rounded-full bg-[#274d8c]/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-28 bottom-10 h-96 w-96 rounded-full bg-plum/20 blur-3xl"
            aria-hidden
          />
          {BERLINSKA_PAINS.map((block, i) => {
            const row = imageRowIndex++;
            return (
              <ProbuzhdenieZigzagRow
                key={block.id ?? `pain-${i}`}
                id={block.id}
                imageSrc={block.imageSrc}
                imageAlt={block.imageAlt}
                imageAspectClass={block.imageAspectClass}
                imageOnLeft={imageOnLeftForImageRow(row, block)}
                eyebrow={block.eyebrow}
                title={block.title}
                largeTitle={block.largeTitle}
                paragraphs={[...block.paragraphs]}
                extraTextBlocks={block.extraTextBlocks}
                list={block.list}
                listTitle={block.listTitle}
                priority={i === 0}
                showTopBorder={i === 0}
                visualTone="midnight"
              />
            );
          })}
          <div
            className="pointer-events-none absolute inset-x-0 top-[38%] h-72 bg-gradient-to-b from-transparent via-[#eef0ff]/30 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 top-[46%] h-80 w-80 rounded-full bg-periwinkle/35 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-24 bottom-36 h-96 w-96 rounded-full bg-white/45 blur-3xl"
            aria-hidden
          />

          <ProbuzhdenieDarkInterlude
            tone="midnight"
            kicker="Дальше"
            title="Почему боль возвращается и как выбрать себя, а не автопилот"
            className="!border-white/10 !bg-transparent"
          />

          {ZIGZAG_TAIL.map((block, i) => {
            const omit = Boolean(block.omitImage);
            return (
              <ProbuzhdenieZigzagRow
                key={block.id ?? `tail-${i}`}
                id={block.id}
                imageSrc={block.imageSrc}
                imageAlt={block.imageAlt}
                imageAspectClass={block.imageAspectClass}
                imageOnLeft={omit ? false : imageOnLeftForImageRow(imageRowIndex++, block)}
                omitImage={omit}
                eyebrow={block.eyebrow}
                title={block.title}
                largeTitle={block.largeTitle}
                paragraphs={[...block.paragraphs]}
                extraTextBlocks={block.extraTextBlocks}
                list={block.list}
                listTitle={block.listTitle}
                visualTone="daylight"
                sliceTone="none"
              />
            );
          })}
        </div>

        <LandingSection id="author" eyebrow="Основательница школы AVATERRA" title="Татьяна Стрельцова" tone="lavender">
          <AuthorMiniBlock
            name="Татьяна Стрельцова"
            roleLabel="Основательница школы AVATERRA"
            quote="Если ты это читаешь — ты уже готов(а) к пробуждению. Этот курс — путь к себе через осознанность и тело."
            facts={[
              '22 года практики работы с подсознанием и телесными практиками',
              'Автор интеграции мышечного тестирования, Карты Эмоций и Регресса',
              'Сопровождение участников в чате на всех трёх неделях программы',
            ]}
          />
        </LandingSection>

        <LandingSection
          id="tariffs"
          eyebrow="Стоимость и условия"
          title="Форматы участия"
          description="Три недели, доступ без ограничения по времени, чат и работа с мастером — в группе или индивидуально."
          tone="surface"
        >
          <TariffsBlock
            tariffs={PROB_TARIFFS.map((t) => ({
              slug: t.slug,
              name: t.name,
              price: t.price,
              description: t.description,
              features: [...t.features],
              badge: t.badge,
              popular: t.popular,
              imageUrl: t.slug === 'probuzhdenie-group' ? PROB_GROUP_TARIFF_IMAGE : '/images/probuzhdenie/card-cover.png',
            }))}
          />
          <p className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--lavender-light)] p-6 text-sm leading-relaxed text-[var(--text-muted)]">
            <strong className="text-[var(--text)]">Курс «Пробуждение» — группа:</strong> 3 недели, 22 000 ₽.{' '}
            <strong className="text-[var(--text)]">Индивидуально:</strong> 3 недели, 44 000 ₽. Доступ к урокам неограничен
            по времени; работа в чате и с мастером — в выбранном формате.
          </p>
        </LandingSection>

        <LandingSection id="faq" eyebrow="Вопросы" title="Что спрашивают перед стартом" tone="bg">
          <FaqBlock items={PROB_FAQ} />
        </LandingSection>

        <FinalCTA
          title="Один шаг к пробуждению"
          subtitle="Выбери формат — и начни 21 день практик «Пробуждения» с поддержкой школы."
          ctaPrimary={{ label: 'Перейти к оплате и форматам', href: '#tariffs' }}
          disclaimer="Курс не заменяет медицинскую и психотерапевтическую помощь. При острых состояниях обратитесь к специалисту."
        />
      </div>
    </>
  );
}

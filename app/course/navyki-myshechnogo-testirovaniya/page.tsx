import type { Metadata } from 'next';
import { AnalyticsCourseView } from '@/components/AnalyticsCourseView';
import { CourseNavykiMarketingArticle } from '@/components/course/CourseNavykiMarketingArticle';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdCoursePage } from '@/components/JsonLdCoursePage';
import { COURSE_PAGE_BLOG_HIGHLIGHTS } from '@/lib/content/blog-course-links';
import { courseIntro, courseModules, COURSE_SLUG, blogPostsMeta } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

const DESCRIPTION =
  'Практический 2-месячный курс: научитесь находить скрытые источники стресса и разговаривать с телом без слов. 6 живых занятий с куратором.';

const OG_IMAGE_PATH = '/images/tatiana/tatiana-hero.png' as const;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${COURSE_SLUG}`;
  const canonical = `${base}${path}`;
  const title = 'Курс Навыки мышечного тестирования | АВАТЕРРА';
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
      images: [
        {
          url: ogImageAbs,
          width: 1024,
          height: 1280,
          alt: 'Татьяна Стрельцова — основательница школы кинезиологии АВАТЕРРА',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: DESCRIPTION,
      images: [ogImageAbs],
    },
    robots: { index: true, follow: true },
  };
}

export default async function CourseNavykiPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const path = `/course/${COURSE_SLUG}`;
  const pageUrl = `${base}${path}`;
  const blogHighlights = COURSE_PAGE_BLOG_HIGHLIGHTS.map((s) => blogPostsMeta.find((p) => p.slug === s)).filter(
    Boolean
  ) as (typeof blogPostsMeta)[number][];

  return (
    <>
      <AnalyticsCourseView />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Курс «Навыки мышечного тестирования»', url: pageUrl },
        ]}
      />
      <JsonLdCoursePage
        name="Навыки мышечного тестирования"
        description={DESCRIPTION}
        pageUrl={pageUrl}
      />
      <CourseNavykiMarketingArticle
        courseIntro={courseIntro}
        courseModules={courseModules}
        blogHighlights={blogHighlights.map((p) => ({
          slug: p.slug,
          title: p.title,
          description: p.description,
        }))}
      />
    </>
  );
}

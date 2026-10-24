/**
 * Schema.org ProfilePage — страница эксперта / мастера (/about).
 * Главная сущность — Person с тем же @id, на который ссылаются JsonLdCourse,
 * JsonLdCoursePage и JsonLdBlogArticle (`…/about#person`): граф не раздваивается.
 */
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdProfilePage({
  id,
  name,
  description,
  url,
  imageUrl,
  jobTitle,
  dateModified,
  sameAs,
  knowsAbout,
  worksFor,
}: {
  /** Стабильный URI сущности Person, напр. https://avaterra.pro/about#person */
  id: string;
  name: string;
  description: string;
  /** Адрес страницы профиля */
  url: string;
  imageUrl: string;
  jobTitle: string;
  /** Дата последней правки содержимого страницы, YYYY-MM-DD */
  dateModified: string;
  /** E-E-A-T: публичные профили автора/школы — связывают сущность с внешними источниками. */
  sameAs?: string[];
  /** Области экспертизы — для понимания тематики автора поисковиками и ИИ. */
  knowsAbout?: string[];
  /** Ссылка на организацию (@id EducationalOrganization из layout). */
  worksFor?: string;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    dateModified,
    inLanguage: 'ru-RU',
    mainEntity: {
      '@type': 'Person',
      '@id': id,
      name,
      description,
      url,
      image: imageUrl,
      jobTitle,
      ...(sameAs?.length ? { sameAs } : {}),
      ...(knowsAbout?.length ? { knowsAbout } : {}),
      ...(worksFor ? { worksFor: { '@id': worksFor } } : {}),
    },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}

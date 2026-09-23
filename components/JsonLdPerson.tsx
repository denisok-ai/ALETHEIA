/**
 * Schema.org Person — страница эксперта / мастера.
 * @id совпадает с ссылкой instructor в JsonLdCourse (главная).
 */
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdPerson({
  id,
  name,
  description,
  url,
  imageUrl,
  jobTitle,
  sameAs,
  knowsAbout,
  worksFor,
}: {
  /** Стабильный URI сущности, напр. https://avaterra.pro/about#person */
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
  jobTitle: string;
  /** E-E-A-T: публичные профили автора/школы — связывают сущность с внешними источниками. */
  sameAs?: string[];
  /** Области экспертизы — для понимания тематики автора поисковиками и ИИ. */
  knowsAbout?: string[];
  /** Ссылка на организацию (@id EducationalOrganization из layout). */
  worksFor?: string;
}) {
  const data = {
    '@context': 'https://schema.org',
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
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}

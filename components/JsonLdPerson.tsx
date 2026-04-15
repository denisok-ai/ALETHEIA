/**
 * Schema.org Person — страница эксперта / мастера.
 * @id совпадает с ссылкой instructor в JsonLdCourse (главная).
 */
export function JsonLdPerson({
  id,
  name,
  description,
  url,
  imageUrl,
  jobTitle,
}: {
  /** Стабильный URI сущности, напр. https://avaterra.pro/about#person */
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
  jobTitle: string;
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
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

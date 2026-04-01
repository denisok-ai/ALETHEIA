/**
 * Разметка Schema.org для поисковиков (организация / образовательная школа).
 */
export function JsonLdOrganization({
  siteUrl,
  phone,
}: {
  siteUrl: string;
  phone?: string | null;
}) {
  const url = siteUrl.replace(/\/$/, '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'AVATERRA',
    alternateName: 'AVATERRA.PRO',
    url,
    description:
      'Phygital школа мышечного тестирования и кинезиологии. Курс «Тело не врет». Основатель — Татьяна Стрельцова.',
    areaServed: 'RU',
    inLanguage: 'ru-RU',
    ...(phone?.trim()
      ? {
          telephone: phone.trim(),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

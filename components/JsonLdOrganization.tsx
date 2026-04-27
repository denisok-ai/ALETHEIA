/**
 * Разметка Schema.org для поисковиков (организация / образовательная школа).
 */
import { BRAND_LOGO_URL } from '@/lib/brand';

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
    '@id': `${url}/#organization`,
    name: 'Школа «AVATERRA»',
    alternateName: ['АВАТЕРРА', 'AVATERRA', 'avaterra.pro'],
    url,
    logo: `${url}${BRAND_LOGO_URL}`,
    description:
      'Школа мышечного тестирования. Курс по обучению методу: причина проблемы за 30 секунд. Основатель — Татьяна Стрельцова.',
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

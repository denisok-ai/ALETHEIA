/**
 * Разметка Schema.org для поисковиков (организация / образовательная школа).
 */
import { BRAND_LOGO_URL } from '@/lib/brand';
import { jsonLdString } from '@/lib/json-ld';
import { SOCIAL_LINKS } from '@/lib/social-links';

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
    // Гео-сигнал уровня города (регион продвижения — Москва); улицу не указываем,
    // пока в настройках нет подтверждённого адреса (сейчас там заглушка)
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Москва',
      addressCountry: 'RU',
    },
    // Соцпрофили: связывают сайт с сущностью бренда в графе знаний
    sameAs: Object.values(SOCIAL_LINKS),
    founder: {
      '@type': 'Person',
      name: 'Татьяна Стрельцова',
      url: `${url}/about`,
    },
    ...(phone?.trim()
      ? {
          telephone: phone.trim(),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}

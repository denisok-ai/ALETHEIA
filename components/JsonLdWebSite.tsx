/**
 * Schema.org: WebSite, связан с организацией через @id (см. JsonLdOrganization).
 */
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdWebSite({
  siteUrl,
  name,
}: {
  siteUrl: string;
  /** Короткое имя для выдачи (например из настроек портала). */
  name: string;
}) {
  const base = siteUrl.replace(/\/$/, '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name,
    url: base,
    inLanguage: 'ru-RU',
    publisher: { '@id': `${base}/#organization` },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}

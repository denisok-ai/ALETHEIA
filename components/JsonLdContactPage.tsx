/**
 * Schema.org: страница контактов + организация с телефоном и email.
 */
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdContactPage({
  siteUrl,
  pageUrl,
  organizationName,
  phone,
  email,
  addressLocality,
  streetAddress,
}: {
  siteUrl: string;
  pageUrl: string;
  organizationName: string;
  phone?: string | null;
  email?: string | null;
  addressLocality?: string | null;
  streetAddress?: string | null;
}) {
  const base = siteUrl.replace(/\/$/, '');
  /** Без @id: на сайте уже есть {@link JsonLdOrganization} с `#organization` — здесь только контакты для страницы. */
  const org: Record<string, unknown> = {
    '@type': 'EducationalOrganization',
    name: organizationName,
    url: base,
  };
  if (phone?.trim()) org.telephone = phone.trim();
  if (email?.trim()) org.email = email.trim();
  if (streetAddress?.trim() || addressLocality?.trim()) {
    org.address = {
      '@type': 'PostalAddress',
      ...(addressLocality?.trim() ? { addressLocality: addressLocality.trim() } : {}),
      ...(streetAddress?.trim() ? { streetAddress: streetAddress.trim() } : {}),
      addressCountry: 'RU',
    };
  }

  const data = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    url: pageUrl,
    name: 'Контакты',
    inLanguage: 'ru-RU',
    mainEntity: org,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}

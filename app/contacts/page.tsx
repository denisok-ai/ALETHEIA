import type { Metadata } from 'next';
import { ContactsPageContent } from '@/components/contacts/ContactsPageContent';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { SEO_CONTACTS } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/contacts`;
  return {
    ...buildPublicPageMetadata({
      title: SEO_CONTACTS.title,
      description: SEO_CONTACTS.description,
      canonical,
    }),
  };
}

export default async function ContactsPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/contacts`;
  const phone = settings.contact_phone?.trim() || '+7 (495) 123-45-67';
  const phoneHref = phone.replace(/\D/g, '').length >= 10 ? `tel:${phone.replace(/\D/g, '')}` : '#';

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Контакты', url: pageUrl },
        ]}
      />
      <ContactsPageContent phone={phone} phoneHref={phoneHref} />
    </>
  );
}

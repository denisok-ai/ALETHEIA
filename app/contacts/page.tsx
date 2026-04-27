import type { Metadata } from 'next';
import { ContactsPageContent } from '@/components/contacts/ContactsPageContent';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdContactPage } from '@/components/JsonLdContactPage';
import { BRAND_SITE_NAME } from '@/lib/brand';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH, SEO_CONTACTS } from '@/lib/seo/pages';
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
      ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
    }),
  };
}

export default async function ContactsPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/contacts`;
  const phone = settings.contact_phone?.trim() || '+7 (495) 123-45-67';
  const phoneHref = phone.replace(/\D/g, '').length >= 10 ? `tel:${phone.replace(/\D/g, '')}` : '#';
  const notifyEmail = settings.resend_notify_email?.trim() || 'info@avaterra.pro';
  const legal = settings.company_legal_address?.trim();
  const streetAddress = legal || 'ул. Здоровья, д. 10';
  const addressLocality = 'Москва';

  return (
    <>
      <JsonLdContactPage
        siteUrl={base}
        pageUrl={pageUrl}
        organizationName={BRAND_SITE_NAME}
        phone={phone}
        email={notifyEmail}
        addressLocality={addressLocality}
        streetAddress={streetAddress}
      />
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

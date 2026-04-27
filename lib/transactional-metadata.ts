import type { Metadata } from 'next';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

/**
 * SEO для служебных URL (оплата, токены, выход): не попадают в выдачу как дубли главной.
 */
export async function transactionalPageMetadata(
  pathname: string,
  title: string
): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return {
    title,
    robots: { index: false, follow: true },
    alternates: { canonical: `${base}${p}` },
  };
}

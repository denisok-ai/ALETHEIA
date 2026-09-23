/**
 * Cron (каждые 6 ч): новые URL sitemap → переобход Яндекса + IndexNow.
 * ?dry=1 — показать новые URL без отправки и без запоминания.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { recrawlNewSitemapUrls } from '@/lib/seo/sitemap-recrawl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  try {
    const result = await recrawlNewSitemapUrls(base, { dryRun });
    if (!dryRun) await markCronOk('sitemap-recrawl');
    return NextResponse.json({ ok: true, ...result, dryRun });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

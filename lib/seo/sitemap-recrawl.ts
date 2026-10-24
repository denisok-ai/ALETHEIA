/**
 * Автопереобход новых URL sitemap: сравнивает текущий sitemap с запомненным
 * набором и отправляет только новые адреса в очередь Яндекса и IndexNow.
 *
 * Зачем: новые термины глоссария и статьи появляются из разных мест (облачный
 * SEO-агент коммитит в main, публикация статей, админка) — переобход не должен
 * зависеть от того, кто и как добавил страницу.
 *
 * Первый запуск только запоминает набор (все текущие URL уже отправлялись).
 */
import { prisma } from '@/lib/db';
import { pingIndexNow } from '@/lib/indexnow';
import { recrawlUrl } from '@/lib/seo/yandex-webmaster';
import { fetchSitemapText, readSitemapUrls } from '@/lib/seo/sitemap-read';

const KNOWN_KEY = 'sitemap_known_urls';
const MAX_PER_RUN = 50;

// /sitemap.xml — индекс: адреса страниц берутся из дочерних карт (lib/seo/sitemap-read.ts).
export { extractSitemapLocs as extractSitemapUrls } from '@/lib/seo/sitemap-read';

export type SitemapRecrawlResult = { total: number; fresh: string[]; recrawled: number; indexNow: boolean; initialized: boolean };

export async function recrawlNewSitemapUrls(base: string, opts: { dryRun?: boolean } = {}): Promise<SitemapRecrawlResult> {
  const current = await readSitemapUrls(`${base}/sitemap.xml`, fetchSitemapText);

  const row = await prisma.systemSetting.findUnique({ where: { key: KNOWN_KEY } });
  let known: string[] | null = null;
  try {
    known = row?.value ? (JSON.parse(row.value) as string[]) : null;
  } catch {
    known = null;
  }

  const save = () =>
    prisma.systemSetting.upsert({
      where: { key: KNOWN_KEY },
      create: { key: KNOWN_KEY, value: JSON.stringify(current), category: 'seo' },
      update: { value: JSON.stringify(current) },
    });

  if (!known) {
    if (!opts.dryRun) await save();
    return { total: current.length, fresh: [], recrawled: 0, indexNow: false, initialized: true };
  }

  const knownSet = new Set(known);
  const fresh = current.filter((u) => !knownSet.has(u)).slice(0, MAX_PER_RUN);
  if (opts.dryRun || fresh.length === 0) {
    return { total: current.length, fresh, recrawled: 0, indexNow: false, initialized: false };
  }

  let recrawled = 0;
  for (const u of fresh) if (await recrawlUrl(u)) recrawled += 1;
  const ping = await pingIndexNow(base, fresh);
  // Запоминаем набор только после отправки — сбой API не «съест» новые URL.
  await save();
  return { total: current.length, fresh, recrawled, indexNow: ping.ok, initialized: false };
}

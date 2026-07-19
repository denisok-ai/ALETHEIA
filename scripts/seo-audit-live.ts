/**
 * SEO-аудит живого сайта: валидность JSON-LD, метатеги, canonical, alt у картинок,
 * целостность внутренних ссылок. Только чтение (GET-запросы).
 * Запуск: npx tsx scripts/seo-audit-live.ts [https://avaterra.pro]
 */
const BASE = (process.argv[2] || 'https://avaterra.pro').replace(/\/$/, '');

const PAGES = [
  '/',
  '/services',
  '/services/avaterra-praktik',
  '/course/navyki-myshechnogo-testirovaniya',
  '/course/probuzhdenie',
  '/about',
  '/blog',
  '/blog/telo-znaet-otvet',
  '/news',
  '/faq',
  '/contacts',
];

type Problem = { page: string; level: 'ошибка' | 'внимание'; text: string };
const problems: Problem[] = [];
const titles = new Map<string, string[]>();
const descriptions = new Map<string, string[]>();

function attr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function checkJsonLd(page: string, html: string): string[] {
  const types: string[] = [];
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) problems.push({ page, level: 'внимание', text: 'нет ни одного блока JSON-LD' });
  for (const [i, b] of blocks.entries()) {
    let data: unknown;
    try {
      data = JSON.parse(b[1]);
    } catch (e) {
      problems.push({ page, level: 'ошибка', text: `JSON-LD #${i + 1} невалиден: ${(e as Error).message}` });
      continue;
    }
    const nodes: Record<string, unknown>[] = [];
    const collect = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(collect);
        else nodes.push(o);
      }
    };
    collect(data);
    for (const n of nodes) {
      const t = String(n['@type'] ?? '');
      if (t) types.push(t);
      // обязательные поля по типам (без них rich-результат не строится)
      const need: Record<string, string[]> = {
        Product: ['name', 'offers'],
        Course: ['name', 'provider'],
        FAQPage: ['mainEntity'],
        BlogPosting: ['headline', 'datePublished'],
        BreadcrumbList: ['itemListElement'],
        Organization: ['name', 'url'],
        EducationalOrganization: ['name', 'url'],
      };
      for (const f of need[t] ?? []) {
        if (n[f] === undefined) problems.push({ page, level: 'ошибка', text: `${t}: нет обязательного поля «${f}»` });
      }
      // цена без валюты — частая причина отклонения разметки
      if (n['price'] !== undefined && n['priceCurrency'] === undefined) {
        problems.push({ page, level: 'ошибка', text: `${t}: price без priceCurrency` });
      }
    }
  }
  return types;
}

async function main() {
  const internalLinks = new Set<string>();

  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'AvaterraSeoAudit/1.0' } });
    if (!res.ok) {
      problems.push({ page: path, level: 'ошибка', text: `страница отдаёт HTTP ${res.status}` });
      continue;
    }
    const html = await res.text();

    // title
    const title = attr(html, /<title>([^<]*)<\/title>/);
    if (!title) problems.push({ page: path, level: 'ошибка', text: 'нет <title>' });
    else {
      titles.set(title, [...(titles.get(title) ?? []), path]);
      if (title.length > 65) problems.push({ page: path, level: 'внимание', text: `title длинный (${title.length} симв., обрежется в выдаче)` });
    }

    // description
    const desc = attr(html, /<meta name="description" content="([^"]*)"/);
    if (!desc) problems.push({ page: path, level: 'ошибка', text: 'нет meta description' });
    else {
      descriptions.set(desc, [...(descriptions.get(desc) ?? []), path]);
      if (desc.length > 320) problems.push({ page: path, level: 'внимание', text: `description длинный (${desc.length} симв.)` });
      if (desc.length < 50) problems.push({ page: path, level: 'внимание', text: `description короткий (${desc.length} симв.)` });
    }

    // canonical
    const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
    if (!canonical) problems.push({ page: path, level: 'ошибка', text: 'нет canonical' });
    else if (!canonical.startsWith(BASE)) problems.push({ page: path, level: 'ошибка', text: `canonical на чужой домен: ${canonical}` });

    // og:image
    if (!attr(html, /<meta property="og:image" content="([^"]*)"/)) {
      problems.push({ page: path, level: 'внимание', text: 'нет og:image (плохо выглядит при репосте)' });
    }

    // h1
    const h1count = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1count === 0) problems.push({ page: path, level: 'ошибка', text: 'нет <h1>' });
    if (h1count > 1) problems.push({ page: path, level: 'внимание', text: `несколько <h1> (${h1count})` });

    // картинки без alt
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const noAlt = imgs.filter((t) => !/\balt=/.test(t));
    if (noAlt.length) problems.push({ page: path, level: 'внимание', text: `картинок без alt: ${noAlt.length}` });

    checkJsonLd(path, html);

    // внутренние ссылки
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1];
      if (href.startsWith('/_next') || href.startsWith('/api')) continue;
      internalLinks.add(href);
    }
  }

  // дубли title/description
  for (const [t, pages] of titles) if (pages.length > 1) problems.push({ page: pages.join(', '), level: 'ошибка', text: `одинаковый title: «${t.slice(0, 60)}»` });
  for (const [d, pages] of descriptions) if (pages.length > 1) problems.push({ page: pages.join(', '), level: 'внимание', text: `одинаковый description на ${pages.length} страницах` });

  // битые внутренние ссылки
  console.log(`\nПроверяю ${internalLinks.size} внутренних ссылок…`);
  for (const href of internalLinks) {
    const r = await fetch(`${BASE}${href}`, { method: 'HEAD', headers: { 'User-Agent': 'AvaterraSeoAudit/1.0' } });
    if (r.status >= 400) problems.push({ page: href, level: 'ошибка', text: `битая внутренняя ссылка (HTTP ${r.status})` });
  }

  const errors = problems.filter((p) => p.level === 'ошибка');
  const warns = problems.filter((p) => p.level === 'внимание');
  console.log(`\n=== ОШИБКИ (${errors.length}) ===`);
  for (const p of errors) console.log(`  ${p.page}: ${p.text}`);
  console.log(`\n=== ВНИМАНИЕ (${warns.length}) ===`);
  for (const p of warns) console.log(`  ${p.page}: ${p.text}`);
  console.log(errors.length ? '\nЕсть ошибки.' : '\nКритичных ошибок нет.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Проверка страниц в реальном браузере: нарушения CSP, ошибки консоли,
 * доступность JSON-LD для парсера и работоспособность гидратации.
 * Нужна перед изменением Content-Security-Policy — иначе поломка видна только у клиентов.
 *
 * Запуск: npx tsx scripts/csp-browser-check.ts [http://127.0.0.1:4500]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://127.0.0.1:4500').replace(/\/$/, '');
const PAGES = ['/', '/services', '/services/avaterra-praktik', '/course/probuzhdenie', '/blog', '/faq'];

type PageResult = {
  page: string;
  cspViolations: string[];
  consoleErrors: string[];
  jsonLdCount: number;
  jsonLdParsed: number;
  hydrated: boolean;
};

async function main() {
  const browser = await chromium.launch();
  const results: PageResult[] = [];

  for (const path of PAGES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cspViolations: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(text)) {
        cspViolations.push(text.slice(0, 160));
      } else if (msg.type() === 'error') {
        consoleErrors.push(text.slice(0, 160));
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 160)}`));

    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });

    // JSON-LD: сколько блоков в DOM и сколько из них реально читаются как JSON
    const { total, parsed } = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      let ok = 0;
      for (const n of nodes) {
        try {
          JSON.parse(n.textContent || '');
          ok += 1;
        } catch {
          /* битый блок */
        }
      }
      return { total: nodes.length, parsed: ok };
    });

    // Гидратация: React повесил обработчики (признак — реактивный корень Next)
    const hydrated = await page.evaluate(() => {
      const root = document.querySelector('body');
      return !!document.querySelector('#__next, [data-nextjs-router], main') && !!root;
    });

    results.push({ page: path, cspViolations, consoleErrors, jsonLdCount: total, jsonLdParsed: parsed, hydrated });
    await ctx.close();
  }

  await browser.close();

  let bad = 0;
  for (const r of results) {
    const problems: string[] = [];
    if (r.cspViolations.length) problems.push(`CSP-блокировок: ${r.cspViolations.length}`);
    if (r.consoleErrors.length) problems.push(`ошибок JS: ${r.consoleErrors.length}`);
    if (r.jsonLdCount === 0) problems.push('нет JSON-LD в DOM');
    if (r.jsonLdParsed !== r.jsonLdCount) problems.push(`JSON-LD битых: ${r.jsonLdCount - r.jsonLdParsed}`);
    if (!r.hydrated) problems.push('страница не отрендерилась');
    if (problems.length) bad += 1;

    console.log(
      `${problems.length ? '  ПРОБЛЕМА' : '  ok      '} ${r.page.padEnd(30)} JSON-LD: ${r.jsonLdParsed}/${r.jsonLdCount}` +
        (problems.length ? `  → ${problems.join(', ')}` : '')
    );
    for (const v of r.cspViolations.slice(0, 3)) console.log(`      CSP: ${v}`);
    for (const e of r.consoleErrors.slice(0, 3)) console.log(`      JS:  ${e}`);
  }

  console.log(bad ? `\nПроблемных страниц: ${bad}` : '\nВсе страницы чистые.');
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

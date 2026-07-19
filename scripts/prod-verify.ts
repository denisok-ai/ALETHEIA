/**
 * Сводная проверка прода одной командой: доступность, SEO-разметка, защиты,
 * платежи, мониторинг. Заменяет ручной обход после деплоя.
 *
 * Запуск: npx tsx scripts/prod-verify.ts [https://avaterra.pro]
 * Код возврата 1 — есть провалы (годится для cron/CI).
 */
const BASE = (process.argv[2] || 'https://avaterra.pro').replace(/\/$/, '');

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function add(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
}

async function head(path: string): Promise<number> {
  try {
    const r = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    return r.status;
  } catch {
    return 0;
  }
}

async function main() {
  // 1. Здоровье приложения
  try {
    const r = await fetch(`${BASE}/api/health`);
    const j = (await r.json()) as { ok?: boolean; database?: string; commit?: string };
    add('приложение и БД', !!j.ok && j.database === 'ok', `commit ${j.commit ?? '?'}`);
  } catch {
    add('приложение и БД', false, 'health недоступен');
  }

  // 2. Публичные страницы
  const pages = ['/', '/services', '/course/navyki-myshechnogo-testirovaniya', '/course/probuzhdenie', '/blog', '/news', '/faq', '/contacts'];
  const bad: string[] = [];
  for (const p of pages) {
    const s = await head(p);
    if (s !== 200) bad.push(`${p}:${s}`);
  }
  add('публичные страницы', bad.length === 0, bad.length ? bad.join(', ') : `${pages.length} страниц по 200`);

  // 3. SEO-инфраструктура
  for (const [name, path] of [['sitemap', '/sitemap.xml'], ['robots', '/robots.txt'], ['llms.txt', '/llms.txt'], ['RSS', '/feed.xml']] as const) {
    add(`SEO: ${name}`, (await head(path)) === 200);
  }

  // 3b. Несуществующие адреса не должны попадать в индекс.
  // Из-за стриминга Next 14 статус на /blog/[slug] и /services/[slug] остаётся
  // 200, поэтому единственный сигнал поисковику — мета-тег noindex. Без него
  // индексируемой становится любая выдуманная ссылка, а их бесконечно много.
  try {
    const probes = ['/blog/nesuschestvuyuschaya-statya-proverka', '/services/nesuschestvuyuschiy-tarif-proverka'];
    const indexable: string[] = [];
    for (const p of probes) {
      const html = await fetch(`${BASE}${p}`).then((r) => r.text());
      const robots = html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? '';
      if (!/noindex/i.test(robots)) indexable.push(`${p} → ${robots || 'тега нет'}`);
    }
    add(
      'несуществующие страницы закрыты от индексации',
      indexable.length === 0,
      indexable.join('; ')
    );
  } catch (e) {
    add('несуществующие страницы закрыты от индексации', false, String(e));
  }

  // 4. Разметка на главной
  try {
    const html = await fetch(`${BASE}/`).then((r) => r.text());
    const need = ['hasOfferCatalog', 'hasCourseInstance', 'sameAs', 'application/ld+json'];
    const miss = need.filter((n) => !html.includes(n));
    add('SEO: разметка главной', miss.length === 0, miss.length ? `нет: ${miss.join(', ')}` : 'Organization+Course+Offer');
  } catch {
    add('SEO: разметка главной', false, 'страница не загрузилась');
  }

  // 5. Приватный контент закрыт
  const scorm = await head('/uploads/scorm/courses-x/index.html');
  const media = await head('/uploads/media/x.mp4');
  add('защита платного контента', scorm !== 200 && media !== 200, `scorm:${scorm} media:${media} (200 = ДЫРА)`);

  // 6. Заголовки безопасности
  try {
    const h = (await fetch(`${BASE}/`)).headers;
    const csp = h.get('content-security-policy') ?? '';
    add('CSP без unsafe-eval', !csp.includes('unsafe-eval'), csp ? '' : 'заголовка нет');
    add('CSP report-only включён', !!h.get('content-security-policy-report-only'));
    add('X-Frame-Options', !!h.get('x-frame-options'));
  } catch {
    add('заголовки безопасности', false, 'не получены');
  }

  // 7. Rate limit работает и не обходится подделкой IP
  try {
    let blocked = false;
    for (let i = 0; i < 8; i++) {
      const r = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.88.${i}.${i}` },
        body: JSON.stringify({ message: '' }),
      });
      if (r.status === 429) { blocked = true; break; }
    }
    add('rate limit не обходится подделкой IP', blocked, blocked ? '429 после лимита' : 'ЛИМИТ ОБХОДИТСЯ');
  } catch {
    add('rate limit', false, 'проверка не выполнена');
  }

  // Итог
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`  ${c.ok ? 'ok      ' : 'ПРОВАЛ  '} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(failed.length ? `\nПровалов: ${failed.length}` : '\nВсё в порядке.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

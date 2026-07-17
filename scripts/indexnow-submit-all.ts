/**
 * Первичная отправка всех публичных URL из sitemap.xml в IndexNow (Яндекс/Bing).
 * Запуск (локально или на сервере): npx tsx scripts/indexnow-submit-all.ts [https://avaterra.pro]
 */
import { pingIndexNow } from '../lib/indexnow';

const base = (process.argv[2] || 'https://avaterra.pro').replace(/\/$/, '');

async function main() {
  const res = await fetch(`${base}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml HTTP ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) throw new Error('В sitemap не найдено URL');
  console.log(`Отправляем ${urls.length} URL из ${base}/sitemap.xml…`);
  const out = await pingIndexNow(base, urls);
  console.log(out.ok ? `OK (HTTP ${out.status})` : `FAIL (HTTP ${out.status ?? 'network'})`);
  if (!out.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

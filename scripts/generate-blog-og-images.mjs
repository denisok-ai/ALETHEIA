/**
 * Генерирует индивидуальные OG-баннеры 1200×630 для статей блога:
 * фирменный лавандовый фон + заголовок статьи + подпись бренда.
 * Файлы: public/images/og/blog-<slug>.png
 * Запуск: node scripts/generate-blog-og-images.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const W = 1200;
const H = 630;

// slug → заголовок (синхронно с blogPostsMeta в lib/content/course-lynda-teaser.ts)
const POSTS = [
  { slug: 'telo-znaet-otvet', title: 'Ваше тело уже знает ответ:\nкак научиться его слышать' },
  { slug: 'pochemu-problemy-vozvrashautysya', title: 'Почему проблемы возвращаются,\nдаже если вы знаете причину' },
  { slug: 'mify-o-myshechnom-testirovanii', title: '3 мифа о мышечном\nтестировании: разоблачение' },
  { slug: 'stress-hronika-ili-signal-tela', title: 'Стресс: найти причину,\nприменяя мышечный тест' },
  { slug: 'pervye-shagi-myshechnogo-testirovaniya', title: 'Первые шаги:\nконтакт, вода и тест' },
];

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Многострочный заголовок в tspan-ах. */
function titleTspans(title, x, y0, lh) {
  return title
    .split('\n')
    .map((line, i) => `<tspan x="${x}" y="${y0 + i * lh}">${escapeXml(line)}</tspan>`)
    .join('');
}

async function build({ slug, title }) {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#faf9fc"/>
      <stop offset="1" stop-color="#e8e6ef"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1060" cy="540" r="240" fill="#ce8fb0" opacity="0.10"/>
  <circle cx="120" cy="80" r="170" fill="#856b92" opacity="0.08"/>
  <rect x="90" y="120" width="80" height="8" rx="4" fill="#ce8fb0"/>
  <text x="90" y="108" font-family="DejaVu Sans, sans-serif" font-size="26" font-weight="bold" fill="#856b92" letter-spacing="2">БЛОГ · АВАТЕРРА</text>
  <text font-family="DejaVu Sans, sans-serif" font-size="56" font-weight="bold" fill="#3d3547">
    ${titleTspans(title, 90, 240, 76)}
  </text>
  <text x="90" y="560" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#856b92">Школа мышечного тестирования</text>
  <text x="90" y="596" font-family="DejaVu Sans, sans-serif" font-size="24" font-weight="bold" fill="#ce8fb0">avaterra.pro</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/images/og/blog-${slug}.png`);
  console.log(`OK: public/images/og/blog-${slug}.png`);
}

await mkdir('public/images/og', { recursive: true });
for (const p of POSTS) await build(p);
console.log('Готово:', POSTS.length, 'баннеров');

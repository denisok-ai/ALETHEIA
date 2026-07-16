/**
 * Генерирует OG-баннер 1200×630 (public/images/og/og-default.png) из героя лендинга:
 * слева текст бренда на лавандовом фоне, справа фото Татьяны.
 * Запуск: node scripts/generate-og-image.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const W = 1200;
const H = 630;
const PHOTO_W = 420;

const photo = await sharp('public/images/tatiana/tatiana-hero.png')
  .resize(PHOTO_W, H, { fit: 'cover', position: 'attention' })
  .toBuffer();

const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#faf9fc"/>
      <stop offset="1" stop-color="#e8e6ef"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="120" cy="560" r="220" fill="#ce8fb0" opacity="0.10"/>
  <circle cx="700" cy="60" r="180" fill="#856b92" opacity="0.08"/>
  <rect x="80" y="150" width="72" height="8" rx="4" fill="#ce8fb0"/>
  <text x="80" y="250" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="76" font-weight="bold" fill="#3d3547">АВАТЕРРА</text>
  <text x="80" y="330" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="34" fill="#856b92">Школа мышечного тестирования</text>
  <text x="80" y="378" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="34" fill="#856b92">и кинезиологии</text>
  <text x="80" y="470" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="26" fill="#5f5467">Ваше тело знает ответ —</text>
  <text x="80" y="508" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="26" fill="#5f5467">научитесь его понимать</text>
  <text x="80" y="580" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="24" font-weight="bold" fill="#ce8fb0">avaterra.pro</text>
</svg>`;

await mkdir('public/images/og', { recursive: true });
await sharp(Buffer.from(bgSvg))
  .composite([{ input: photo, left: W - PHOTO_W, top: 0 }])
  .png()
  .toFile('public/images/og/og-default.png');

console.log('OK: public/images/og/og-default.png');

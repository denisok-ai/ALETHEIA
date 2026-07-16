/**
 * Генерирует app/favicon.ico из логотипа бренда (32×32 и 16×16 PNG внутри ICO-контейнера,
 * PNG-запись в ICO валидна начиная с Windows Vista и поддержана всеми браузерами).
 * Запуск: node scripts/generate-favicon.mjs
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SIZES = [16, 32];

const pngs = await Promise.all(
  SIZES.map((size) =>
    sharp('public/images/LOGO.png')
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  )
);

// ICONDIR (6 байт) + ICONDIRENTRY (16 байт на изображение) + PNG-данные
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);

let offset = 6 + 16 * pngs.length;
const entries = [];
for (let i = 0; i < pngs.length; i++) {
  const e = Buffer.alloc(16);
  e.writeUInt8(SIZES[i] === 256 ? 0 : SIZES[i], 0); // width
  e.writeUInt8(SIZES[i] === 256 ? 0 : SIZES[i], 1); // height
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  entries.push(e);
}

await writeFile('app/favicon.ico', Buffer.concat([header, ...entries, ...pngs]));
console.log('OK: app/favicon.ico');

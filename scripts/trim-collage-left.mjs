/**
 * Обрезка однотонных белых полей у hero/collage-left.png — рука крупнее при object-contain.
 * Запуск: node scripts/trim-collage-left.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public/images/hero/collage-left.png');
const backup = join(root, 'public/images/hero/collage-left.png.bak');

const buf = readFileSync(target);
const before = await sharp(buf).metadata();
// threshold: насколько пиксель может отличаться от «углового» при обрезке (антидither)
const trimmed = await sharp(buf).trim({ threshold: 18 }).png({ compressionLevel: 9 }).toBuffer();
const after = await sharp(trimmed).metadata();

console.log(`trim: ${before.width}x${before.height} -> ${after.width}x${after.height}`);

writeFileSync(backup, buf);
writeFileSync(target, trimmed);
unlinkSync(backup);
console.log(`written ${target}`);

/**
 * Готовит avaterra-gold-logo.png для PDF: trim полей, альфа, ресайз до 640px по длинной стороне (без «мыла» при печати).
 * Запуск: npm run certificates:optimize-logo
 */
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const input = path.join(process.cwd(), 'public', 'images', 'avaterra-gold-logo.png');

async function main() {
  if (!existsSync(input)) {
    console.error('Нет файла:', input);
    process.exit(1);
  }

  const meta = await sharp(input).metadata();
  let pipeline = sharp(input).ensureAlpha();

  try {
    pipeline = pipeline.trim({ threshold: 12 });
  } catch {
    /* trim не всегда применим */
  }

  const buf = await pipeline
    .resize({
      width: 640,
      height: 640,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
    .toBuffer();

  writeFileSync(input, buf);
  const after = await sharp(input).metadata();
  console.log(
    'OK',
    input,
    `${meta.width}x${meta.height} → ${after.width}x${after.height}`,
    `${buf.length} bytes`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

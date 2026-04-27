/**
 * Собирает ZIP: образцы PDF из public/certificates-samples/ + золотой логотип.
 * Итог: public/certificates-assets/avaterra-certificates-bundle.zip (прямая ссылка с сайта).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';

const root = process.cwd();
const publicDir = join(root, 'public');
const samplesDir = join(publicDir, 'certificates-samples');
const outDir = join(publicDir, 'certificates-assets');
const logoPath = join(publicDir, 'images', 'avaterra-gold-logo.png');
const outZip = join(outDir, 'avaterra-certificates-bundle.zip');

async function main() {
  if (!existsSync(samplesDir)) {
    console.error('Нет папки', samplesDir, '— сначала: npm run certificates:export-samples');
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const zip = new JSZip();
  const folder = zip.folder('avaterra-certificates');
  if (!folder) throw new Error('zip folder');

  for (const name of readdirSync(samplesDir)) {
    if (!name.endsWith('.pdf')) continue;
    folder.file(name, readFileSync(join(samplesDir, name)));
  }

  if (existsSync(logoPath)) {
    folder.file('avaterra-gold-logo.png', readFileSync(logoPath));
  } else {
    console.warn('Предупреждение: нет', logoPath);
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  writeFileSync(outZip, buf);
  console.log('OK', outZip, buf.length, 'bytes');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Починка alias-файлов (шрифты, изображения и др.) во всех распакованных SCORM v*.
 *   npx tsx scripts/fix-scorm-font-aliases.ts
 *   npx tsx scripts/fix-scorm-font-aliases.ts courses-course-avaterra-praktik
 */
import path from 'path';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { fixTemplateFontAliases } from '../lib/scorm/fix-template-font-aliases';

async function main() {
  const filter = process.argv[2]?.trim();
  const base = path.join(process.cwd(), 'public', 'uploads', 'scorm');
  if (!existsSync(base)) {
    console.log('Нет папки', base);
    return;
  }

  let total = 0;
  const courses = await readdir(base, { withFileTypes: true });
  for (const d of courses) {
    if (!d.isDirectory() || !d.name.startsWith('courses-')) continue;
    if (filter && d.name !== filter) continue;
    const courseDir = path.join(base, d.name);
    const versions = await readdir(courseDir, { withFileTypes: true });
    for (const v of versions) {
      if (!v.isDirectory() || !/^v\d+$/i.test(v.name)) continue;
      const root = path.join(courseDir, v.name);
      const n = await fixTemplateFontAliases(root);
      if (n > 0) console.log(`+${n} aliases`, root);
      total += n;
    }
  }
  console.log('Готово, создано alias-файлов:', total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

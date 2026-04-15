/**
 * Однократно применить CSS-оверрайды ко всем папкам v* в public/uploads/scorm (уже распакованные пакеты).
 */
import path from 'path';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { applyScormVideoOverrides } from '../lib/scorm/apply-video-overrides';

async function main() {
  const base = path.join(process.cwd(), 'public', 'uploads', 'scorm');
  if (!existsSync(base)) {
    console.log('Нет папки', base);
    return;
  }
  const courses = await readdir(base, { withFileTypes: true });
  let n = 0;
  for (const d of courses) {
    if (!d.isDirectory() || !d.name.startsWith('courses-')) continue;
    const courseDir = path.join(base, d.name);
    const versions = await readdir(courseDir, { withFileTypes: true });
    for (const v of versions) {
      if (!v.isDirectory() || !/^v\d+$/i.test(v.name)) continue;
      const root = path.join(courseDir, v.name);
      const ok = await applyScormVideoOverrides(root);
      if (ok) {
        console.log('OK', root);
        n += 1;
      }
    }
  }
  console.log('Готово, патчей:', n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

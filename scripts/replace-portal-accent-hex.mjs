/**
 * Одноразово: заменить хардкод indigo в className на CSS-переменные портала.
 * Не трогает stroke/fill в кавычках без скобок Tailwind.
 */
import fs from 'node:fs';
import path from 'node:path';

const exts = new Set(['.tsx', '.ts', '.css']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === '.next') continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(name.name))) out.push(p);
  }
  return out;
}

const pairs = [
  [/\[#6366F1\]/g, '[var(--portal-accent)]'],
  [/\[#4F46E5\]/g, '[var(--portal-accent-dark)]'],
  [/\[#4338CA\]/g, '[var(--portal-accent-dark)]'],
  [/\[#EEF2FF\]/g, '[var(--portal-accent-soft)]'],
  [/\[#C7D2FE\]/g, '[var(--portal-accent-muted)]'],
];

const base = process.cwd();
let nFiles = 0;
for (const file of walk(base)) {
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  for (const [re, rep] of pairs) s = s.replace(re, rep);
  if (s !== orig) {
    fs.writeFileSync(file, s);
    nFiles++;
  }
}
console.log('updated', nFiles, 'files');

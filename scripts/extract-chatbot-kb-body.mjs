import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const s = fs.readFileSync(path.join(__dirname, 'setup-chatbot-knowledge-base.ts'), 'utf8');
const marker = 'const KNOWLEDGE_BASE = `';
const si = s.indexOf(marker);
if (si === -1) {
  console.error('KNOWLEDGE_BASE marker not found');
  process.exit(1);
}
let j = si + marker.length;
let chunk = '';
while (j < s.length) {
  const ch = s[j];
  if (ch === '\\' && j + 1 < s.length && s[j + 1] === '`') {
    chunk += '`';
    j += 2;
    continue;
  }
  if (ch === '`') break;
  chunk += ch;
  j++;
}
const out = path.join(__dirname, 'chatbot-kb-body.md');
fs.writeFileSync(out, chunk);
console.log('wrote', out, chunk.length);

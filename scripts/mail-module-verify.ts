/**
 * Лёгкие проверки инвариантов почтового модуля без сети и без ключей API.
 * Запуск: npm run verify:mail-module
 */
import assert from 'node:assert/strict';

import { sanitizeInboundHtml } from '../lib/inmail-sync';

function testSanitizeInboundHtmlStripsScripts() {
  const dirty = '<script>alert(1)</script><p onclick="evil()">Привет</p><a href="mailto:a@b.ru">mail</a>';
  const clean = sanitizeInboundHtml(dirty);
  assert(!clean.toLowerCase().includes('<script'), 'script-тег должен быть удалён');
  assert(!clean.includes('onclick'), 'onclick должен быть удалён');
  assert(clean.includes('Привет'), 'безопасный текст сохраняется');
}

function main() {
  testSanitizeInboundHtmlStripsScripts();
  console.log('[verify:mail-module] OK — санитизация входящего HTML');
}

main();

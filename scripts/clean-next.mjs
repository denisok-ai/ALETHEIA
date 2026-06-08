/**
 * Удаляет каталог .next (кроссплатформенно). Нужен, чтобы не смешивать артефакты
 * Turbopack (next dev --turbo) и продакшен-сборку webpack (next build / next start).
 * Дополнительно снимает node_modules/.cache — иначе после сбоев dev иногда остаётся
 * webpack-runtime со ссылкой на несуществующий чанк (напр. ./1682.js).
 */
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const rmOpts = { recursive: true, force: true, maxRetries: 12, retryDelay: 200 };

const dir = join(process.cwd(), '.next');
if (existsSync(dir)) {
  rmSync(dir, rmOpts);
  console.log('[clean-next] removed .next');
}

const nmCache = join(process.cwd(), 'node_modules', '.cache');
if (existsSync(nmCache)) {
  rmSync(nmCache, rmOpts);
  console.log('[clean-next] removed node_modules/.cache');
}

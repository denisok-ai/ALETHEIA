/**
 * Удаляет каталог .next (кроссплатформенно). Нужен, чтобы не смешивать артефакты
 * Turbopack (next dev --turbo) и продакшен-сборку webpack (next build / next start).
 */
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), '.next');
if (existsSync(dir)) {
  rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 150,
  });
  console.log('[clean-next] removed .next');
}

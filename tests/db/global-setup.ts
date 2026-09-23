/**
 * Свежая sqlite для DB-тестов: удалить старую, применить миграции прода.
 * Схема — ровно та, что в prisma/migrations, никакого db push.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default function setup() {
  const dir = path.resolve(__dirname, '..', '..', '.vitest-db');
  const db = path.join(dir, 'test.db');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of [db, `${db}-journal`, `${db}-wal`, `${db}-shm`]) {
    try {
      fs.rmSync(f);
    } catch {
      /* нет файла */
    }
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `file:${db}` },
    stdio: 'pipe',
    cwd: path.resolve(__dirname, '..', '..'),
  });
}

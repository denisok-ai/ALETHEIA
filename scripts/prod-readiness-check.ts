/**
 * Проверка обязательных переменных окружения и типичных проблем перед production-сборкой.
 * Запуск: npm run prod:readiness
 * Перед деплоем также выполните: npm run predeploy (lint + build) и prisma migrate deploy на сервере.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/** Минимальная подгрузка .env / .env.local (NEXTAUTH_SECRET и др. не в datasource Prisma). */
function loadEnvFile(rel: string) {
  const p = path.join(process.cwd(), rel);
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf-8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

const errors: string[] = [];
const warnings: string[] = [];

function need(name: string, opts?: { minLen?: number; hint?: string }) {
  const v = process.env[name];
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) errors.push(`Отсутствует или пусто: ${name}${opts?.hint ? ` (${opts.hint})` : ''}`);
  else if (opts?.minLen && t.length < opts.minLen) {
    errors.push(`${name}: минимум ${opts.minLen} символов (сейчас ${t.length})`);
  }
}

need('DATABASE_URL', { hint: 'строка подключения Prisma' });
need('NEXTAUTH_SECRET', { minLen: 32, hint: 'минимум 32 символа для подписи сессий' });

const db = process.env.DATABASE_URL?.trim() ?? '';
if (db.startsWith('file:')) {
  warnings.push(
    'DATABASE_URL указывает на SQLite (file:…). На VPS допустимо при одном инстансе и бэкапах — см. docs/Production-Server.md; для масштабирования рассмотрите PostgreSQL (docs/Deploy.md § БД).'
  );
}

if (!process.env.NEXT_PUBLIC_URL?.trim() && !process.env.VERCEL_URL && !process.env.NEXTAUTH_URL?.trim()) {
  warnings.push(
    'Не заданы NEXT_PUBLIC_URL / VERCEL_URL / NEXTAUTH_URL — абсолютные ссылки и NextAuth могут быть неверны до настройки в Портал → Настройки или env.'
  );
}

const cwd = process.cwd();
if (!existsSync(path.join(cwd, 'public', 'sw.js'))) {
  warnings.push('Нет public/sw.js — рекомендуется заглушка для /sw.js (см. docs/Deploy.md).');
}

if (errors.length) {
  console.error('[prod:readiness] Ошибки:\n', errors.map((e) => `  - ${e}`).join('\n'));
  console.error('\nСм. .env.example и docs/Env-Config.md.');
  process.exit(1);
}

if (warnings.length) {
  console.warn('[prod:readiness] Предупреждения:\n', warnings.map((w) => `  - ${w}`).join('\n'));
}

console.log('[prod:readiness] Базовые проверки пройдены.');
console.log('Следующие шаги перед выкатом: npm run predeploy; на сервере: npx prisma migrate deploy; см. docs/Deploy.md (чек-лист).');
process.exit(0);

/**
 * Синхронизация TELEGRAM_* из БД в /opt/ALETHEIA/.env для быстрого webhook (без decrypt на каждый POST).
 * На VPS: npx tsx scripts/sync-telegram-env-to-dotenv.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { getEnvOverrides } from '../lib/settings';

const ENV_PATH = resolve(process.env.DEPLOY_ROOT || process.cwd(), '.env');

const KEYS = [
  { key: 'TELEGRAM_BOT_TOKEN', field: 'telegram_bot_token' as const },
  { key: 'TELEGRAM_WEBHOOK_SECRET', field: 'telegram_webhook_secret' as const },
];

async function main() {
  const overrides = await getEnvOverrides();
  let content = '';
  try {
    content = readFileSync(ENV_PATH, 'utf8');
  } catch {
    content = '';
  }
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  const touched = new Set<string>();

  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=/);
    if (m && KEYS.some((k) => k.key === m[1])) {
      const spec = KEYS.find((k) => k.key === m[1])!;
      const val = overrides[spec.field]?.trim();
      if (val) {
        out.push(`${spec.key}=${val}`);
        touched.add(spec.key);
      } else {
        out.push(line);
      }
    } else {
      out.push(line);
    }
  }

  for (const spec of KEYS) {
    if (touched.has(spec.key)) continue;
    const val = overrides[spec.field]?.trim();
    if (val) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`${spec.key}=${val}`);
      touched.add(spec.key);
    }
  }

  const next = out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  writeFileSync(ENV_PATH, next, { mode: 0o600 });
  console.log('synced to', ENV_PATH, 'keys:', [...touched].join(', ') || '(none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

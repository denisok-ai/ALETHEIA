#!/usr/bin/env npx tsx
/** CLI: проверить getMyCommands (без вывода токена). */
import { getEnvOverrides } from '../lib/settings';
import { telegramApiFetch } from '../lib/telegram-fetch';

async function main() {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) {
    console.log('NO_TOKEN');
    process.exit(1);
  }
  const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/getMyCommands`);
  const data = (await res.json()) as { ok?: boolean; result?: { command: string; description: string }[] };
  const cmds = (data.result ?? []).map((c) => c.command);
  console.log('count:', cmds.length);
  console.log('about_index:', cmds.indexOf('about'));
  console.log('about_present:', cmds.includes('about'));
  console.log('first_6:', cmds.slice(0, 6).join(', '));
  const about = data.result?.find((c) => c.command === 'about');
  if (about) console.log('about_description:', about.description);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

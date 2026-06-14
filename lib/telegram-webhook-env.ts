/**
 * Кэш токена/секрета webhook: горячий путь без БД на каждый POST от Telegram.
 * Прогрев в instrumentation.register(); обновление раз в минуту.
 * settings импортируется динамически (избегаем node:crypto в webpack-графе instrumentation).
 */

const REFRESH_MS = 60_000;

type WebhookSecrets = {
  botToken?: string;
  webhookSecret?: string;
};

let cache: { at: number; data: WebhookSecrets } | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function fromProcessEnv(): WebhookSecrets {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
  };
}

async function loadFromDb(): Promise<WebhookSecrets> {
  const { getEnvOverrides } = await import('./settings');
  const overrides = await getEnvOverrides();
  return {
    botToken: overrides.telegram_bot_token?.trim() || undefined,
    webhookSecret: overrides.telegram_webhook_secret?.trim() || undefined,
  };
}

/** Синхронный доступ: process.env + in-memory cache (без await). */
export function getWebhookSecretsSync(): WebhookSecrets {
  const env = fromProcessEnv();
  if (env.botToken && env.webhookSecret) return env;
  if (cache) return { ...env, ...cache.data };
  return env;
}

/** Асинхронный доступ с подгрузкой из БД при холодном кэше. */
export async function getWebhookSecrets(): Promise<WebhookSecrets> {
  const env = fromProcessEnv();
  if (env.botToken && env.webhookSecret) return env;

  const now = Date.now();
  if (cache && now - cache.at < REFRESH_MS) {
    return { ...env, ...cache.data };
  }

  const data = await loadFromDb();
  cache = { at: now, data };
  return { ...env, ...data };
}

/** Прогрев при старте процесса и периодическое обновление. */
export async function warmTelegramWebhookEnv(): Promise<void> {
  try {
    const data = await loadFromDb();
    cache = { at: Date.now(), data };
    const env = fromProcessEnv();
    console.log(
      `[telegram-webhook-env] warmed token=${Boolean(data.botToken || env.botToken)} secret=${Boolean(data.webhookSecret || env.webhookSecret)}`
    );
  } catch (e) {
    console.error('[telegram-webhook-env] warm failed', e);
  }

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void loadFromDb()
        .then((data) => {
          cache = { at: Date.now(), data };
        })
        .catch((e) => console.error('[telegram-webhook-env] refresh failed', e));
    }, REFRESH_MS);
    refreshTimer.unref?.();
  }
}

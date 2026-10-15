/**
 * Google OAuth для Search Console: обмен долгоживущего refresh-токена на access-токен.
 *
 * Ключи лежат в /opt/ALETHEIA/secrets/seo.env (читаются через lib/seo/secrets.ts), не в .env.
 * OAuth-приложение в Google в режиме Testing: refresh-токен живёт 7 дней, потом приходит
 * invalid_grant — тогда токен выпускается заново вручную.
 *
 * Токены и секреты не логируются и не попадают в тексты ошибок.
 */
import { getSeoSecret } from './secrets';
import type { SeoConnectorStatus } from './metric-types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Запас до истечения: токен обновляем за 60 с, чтобы не словить протухание посреди запроса. */
const EXPIRY_MARGIN_MS = 60_000;
const TIMEOUT_MS = 15_000;

let cached: { token: string; expiresAt: number } | null = null;

export type GoogleTokenResult = { status: SeoConnectorStatus; token: string | null };

/** Сброс кеша токена (для тестов и после 401 от API). */
export function resetGoogleTokenCache(): void {
  cached = null;
}

/** Имя ошибки без текста — сообщение может содержать детали запроса, их не выводим. */
function errName(e: unknown): string {
  return e instanceof Error ? e.name : 'неизвестная ошибка';
}

/**
 * Access-токен Google. token === null, если статус не ok.
 * Результат ok кешируется в памяти до expires_in − 60 с.
 */
export async function getGoogleAccessToken(): Promise<GoogleTokenResult> {
  if (cached && Date.now() < cached.expiresAt) {
    return { status: { state: 'ok' }, token: cached.token };
  }

  const clientId = getSeoSecret('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = getSeoSecret('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = getSeoSecret('GOOGLE_OAUTH_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    return {
      status: {
        state: 'not_configured',
        reason: 'не заданы GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN',
      },
      token: null,
    };
  }

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { status: { state: 'error', reason: `сеть до oauth2.googleapis.com: ${errName(e)}` }, token: null };
  }

  const body = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string }
    | null;

  if (!res.ok) {
    if (body?.error === 'invalid_grant') {
      return {
        status: {
          state: 'error',
          reason:
            'refresh-токен Google отозван или истёк (приложение в режиме Testing живёт 7 дней) — выпустить заново',
        },
        token: null,
      };
    }
    // Код ошибки OAuth (например invalid_client) — короткое слово без секретов, его можно показать.
    const code = body?.error && /^[a-z_]+$/.test(body.error) ? `, ${body.error}` : '';
    return {
      status: { state: 'error', reason: `обмен токена Google не удался (HTTP ${res.status}${code})` },
      token: null,
    };
  }

  if (!body?.access_token) {
    return { status: { state: 'error', reason: 'Google не вернул access-токен' }, token: null };
  }

  const expiresIn = body.expires_in ?? 3600;
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - EXPIRY_MARGIN_MS),
  };
  return { status: { state: 'ok' }, token: body.access_token };
}

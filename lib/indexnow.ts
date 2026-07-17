/**
 * IndexNow — мгновенное уведомление поисковиков (Яндекс, Bing) об изменённых URL.
 * Ключ подтверждается файлом /{KEY}.txt (app/[indexnow-key]/route.ts — отдаёт ключ).
 * Протокол: https://www.indexnow.org/ — один POST до 10 000 URL, шлюзы обмениваются
 * данными между собой, поэтому достаточно одного эндпоинта.
 */

export const INDEXNOW_KEY = 'a9e73fb67f8a01ca61c0adb7e14de2de';

/** Основной шлюз; Яндекс и Bing синхронизируются через общий протокол. */
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Уведомить поисковики об изменённых URL (одного хоста).
 * Не бросает исключений — сбой индексации не должен ломать основной поток.
 */
export async function pingIndexNow(
  siteUrl: string,
  urls: string[]
): Promise<{ ok: boolean; status?: number }> {
  if (urls.length === 0) return { ok: true };
  try {
    const host = new URL(siteUrl).host;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${siteUrl.replace(/\/$/, '')}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10_000),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 — принято, 202 — принято (ключ проверят позже)
    return { ok: res.status === 200 || res.status === 202, status: res.status };
  } catch {
    return { ok: false };
  }
}

/**
 * Fire-and-forget пинг по относительным путям (для admin-мутаций контента).
 * Прод-домен берётся из настроек; localhost не пингуем.
 */
export function pingIndexNowForPathsAsync(paths: string[]): void {
  void (async () => {
    try {
      const { getSystemSettings } = await import('@/lib/settings');
      const { normalizeSiteUrl } = await import('@/lib/site-url');
      const settings = await getSystemSettings();
      const base = normalizeSiteUrl(settings.site_url || '').replace(/\/$/, '');
      if (!base || base.includes('localhost') || base.includes('127.0.0.1')) return;
      await pingIndexNow(base, paths.map((p) => `${base}${p.startsWith('/') ? p : `/${p}`}`));
    } catch {
      // индексация не должна ломать основной поток
    }
  })();
}

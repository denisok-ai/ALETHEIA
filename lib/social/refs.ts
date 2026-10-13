/**
 * Метки ?ref=<сеть>-<NN> (T3.3): формат, код сети по метке, ссылка с меткой.
 *
 * Чистый модуль без импортов: им пользуются middleware (proxy.ts), API-маршруты
 * и тесты. Образец логики — audio-mastering-web/backend/app/social/captions.py
 * (tracked_url), но метка здесь — `tg-01`, а не `fb-01`: префиксы свои у AVATERRA.
 */

/** Допустимая метка: две латинские буквы префикса сети, дефис, 2–3 цифры (tg-01, vk-003). */
export const REF_RE = /^[a-z]{2}-\d{2,3}$/;

/** Префикс метки → код сети (SocialNetwork.code). */
export const REF_PREFIX_TO_NETWORK: Readonly<Record<string, string>> = {
  tg: 'telegram',
  vk: 'vk',
  yt: 'youtube',
  rt: 'rutube',
  dz: 'dzen',
  ig: 'instagram',
};

/** Код сети → префикс метки (обратная таблица). */
export const NETWORK_TO_REF_PREFIX: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(REF_PREFIX_TO_NETWORK).map(([prefix, network]) => [network, prefix]),
);

export function isValidRefCode(value: unknown): value is string {
  return typeof value === 'string' && REF_RE.test(value);
}

/** Валидная метка или null: используется для query-параметра и для значения cookie. */
export function refFromValue(value: string | null | undefined): string | null {
  return isValidRefCode(value) ? value : null;
}

/** Код сети по метке; null, если метка некорректна или префикс неизвестен. */
export function networkForRef(refCode: string): string | null {
  if (!isValidRefCode(refCode)) return null;
  return REF_PREFIX_TO_NETWORK[refCode.slice(0, 2)] ?? null;
}

/**
 * Метка материала в сети: refCodeFor('telegram', 1) → 'tg-01'.
 * Некорректная сеть или номер — ошибка вызова (это баг вызывающего кода, не данные).
 */
export function refCodeFor(networkCode: string, itemNumber: number): string {
  const prefix = NETWORK_TO_REF_PREFIX[networkCode];
  if (!prefix) throw new Error(`unknown network: ${networkCode}`);
  if (!Number.isInteger(itemNumber) || itemNumber < 1 || itemNumber > 999) {
    throw new Error('item number must be an integer 1..999');
  }
  return `${prefix}-${String(itemNumber).padStart(2, '0')}`;
}

/**
 * Ссылка с меткой: trackedUrl('https://avaterra.pro/lufs?utm=x#faq', 'tg-01')
 * → 'https://avaterra.pro/lufs?utm=x&ref=tg-01#faq'.
 *
 * Query не переписываем через URLSearchParams: он перекодирует чужие параметры.
 * Старый ref в query заменяется, якорь (#…) остаётся последним.
 */
export function trackedUrl(url: string, refCode: string): string {
  if (!isValidRefCode(refCode)) throw new Error('ref code must look like tg-01');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('url must be absolute');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('url must be http(s)');
  }

  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  const base = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const query = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';

  const params = query
    .split('&')
    .filter((part) => part !== '' && part.split('=')[0] !== 'ref');
  params.push(`ref=${refCode}`);
  return `${base}?${params.join('&')}${hash}`;
}

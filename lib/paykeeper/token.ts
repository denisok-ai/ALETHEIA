/**
 * Разбор ответа GET /info/settings/token/
 */

export function parsePayKeeperToken(responseText: string): string {
  const trimmed = responseText.trim();
  try {
    const parsed = JSON.parse(trimmed) as { token?: unknown };
    if (typeof parsed.token === 'string' && parsed.token.trim()) {
      return parsed.token.trim();
    }
  } catch {
    // Некоторые инсталляции могут отдавать токен текстом.
  }

  if (/^[a-f0-9]{16,}$/i.test(trimmed)) return trimmed;
  throw new Error('PayKeeper token not found in response');
}

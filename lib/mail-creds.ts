/**
 * Нормализация логина/пароля почты: CRLF из Windows-.env и пробелы по краям ломают SASL (535).
 */
export function normalizeMailCred(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/\r/g, '');
}

/** Email для AUTH обычно без учёта регистра. */
export function normalizeMailboxUser(raw: string | undefined): string {
  return normalizeMailCred(raw).toLowerCase();
}

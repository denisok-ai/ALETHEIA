/**
 * Проверка URL на тестовые/placeholder-значения (example.com и пустые).
 * Используется, чтобы не открывать в UI ссылки на example.com и не вводить пользователя в заблуждение.
 */
export function isPlaceholderOrExampleUrl(url: string | null | undefined): boolean {
  if (url == null || url === '' || url === '#') return true;
  try {
    const u = new URL(url, 'http://localhost');
    return u.hostname === 'example.com' || u.hostname === 'www.example.com';
  } catch {
    return false;
  }
}

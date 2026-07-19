/**
 * Единый способ получить IP клиента за nginx.
 *
 * Нельзя брать ПЕРВЫЙ элемент X-Forwarded-For: его задаёт клиент, а наш nginx
 * (`$proxy_add_x_forwarded_for`) лишь дописывает реальный адрес в конец.
 * Раньше `split(',')[0]` использовался в лимитере, логах посещений и журнале
 * согласий — то есть лимиты обходились, а в юридически значимую запись согласия
 * попадал подделанный адрес (проверено эксплуатацией на проде 2026-07-19).
 *
 * Доверяем:
 *  1. X-Real-IP — nginx перезаписывает его из `$remote_addr`, подделать нельзя;
 *  2. последний элемент X-Forwarded-For — его дописал наш же nginx.
 */
export function clientIpFromHeaders(get: (name: string) => string | null): string | null {
  const xri = get('x-real-ip');
  if (xri?.trim()) return xri.trim();

  const xff = get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return null;
}

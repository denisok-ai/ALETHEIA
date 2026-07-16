/**
 * Сравнение секретов без утечки по времени: обычное === прерывается на первом
 * несовпавшем байте и позволяет подбирать токен посимвольно.
 * Хэшируем обе строки (уравнивает длину) и сравниваем через crypto.timingSafeEqual.
 */
import crypto from 'crypto';

export function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

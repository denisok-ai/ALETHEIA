/** Файл подтверждения ключа IndexNow (см. lib/indexnow.ts). */
import { INDEXNOW_KEY } from '@/lib/indexnow';

export function GET() {
  return new Response(INDEXNOW_KEY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

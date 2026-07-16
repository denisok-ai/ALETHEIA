/**
 * Внутренняя проверка доступа к приватной статике /uploads/media/* и
 * /uploads/verifications/* для nginx auth_request (по аналогии со scorm/access-check).
 * Достаточно валидной сессии: имена файлов — случайные nanoid, «горизонтальный»
 * перебор невозможен; тонкая проверка прав — в API-маршрутах выдачи ссылок.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }
  return new NextResponse(null, { status: 204 });
}

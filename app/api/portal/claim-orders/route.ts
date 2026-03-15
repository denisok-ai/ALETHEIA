/**
 * Route Handler: привязка оплаченных заказов по email.
 * Вызывается при первом входе студента в портал. Cookie ограничивает частоту (1 день).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { claimPaidOrdersForUser } from '@/lib/claim-orders';

const CLAIM_COOKIE = 'avaterra_claim_checked';
const CLAIM_COOKIE_MAX_AGE = 86400; // 1 day

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string; role?: string } | undefined;
  if (!user?.id || !user?.email || user?.role !== 'user') {
    return NextResponse.json({ ok: true });
  }

  if (request.cookies.get(CLAIM_COOKIE)?.value) {
    return NextResponse.json({ ok: true });
  }

  const emailNorm = user.email.trim().toLowerCase();
  try {
    await claimPaidOrdersForUser(user.id, emailNorm);
  } catch (e) {
    console.error('Portal claim-orders:', e);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLAIM_COOKIE, '1', { maxAge: CLAIM_COOKIE_MAX_AGE, path: '/portal' });
  return res;
}

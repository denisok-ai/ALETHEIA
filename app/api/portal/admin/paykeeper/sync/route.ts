/**
 * Admin: сверка заказа с PayKeeper.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { syncOrderWithPaykeeper } from '@/lib/paykeeper';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { orderNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
  if (!orderNumber) {
    return NextResponse.json({ error: 'Укажите orderNumber' }, { status: 400 });
  }

  const result = await syncOrderWithPaykeeper(orderNumber);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

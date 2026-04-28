/**
 * Admin: JSON с QR СБП по сохранённому invoice_url (returnFormat=json).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appendSbpQrParams } from '@/lib/paykeeper';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const orderNumber = request.nextUrl.searchParams.get('orderNumber')?.trim();
  if (!orderNumber) return NextResponse.json({ error: 'orderNumber' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { paykeeperInvoiceUrl: true },
  });
  const baseUrl = order?.paykeeperInvoiceUrl?.trim();
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'У заказа нет paykeeperInvoiceUrl — создайте счёт заново' },
      { status: 400 }
    );
  }

  const url = appendSbpQrParams(baseUrl);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return NextResponse.json({ ok: res.ok, status: res.status, url, data: json });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

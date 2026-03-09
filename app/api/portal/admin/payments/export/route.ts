/**
 * Admin: export orders as CSV.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';

export async function GET(request: NextRequest) {
  const reqClient = createClientFromRequest(request);
  if (!reqClient) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  const { data: { user } } = await reqClient.auth.getUser();
  const { data: profile } = user ? await reqClient.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  if (!user || (profile?.role as string) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: orders } = await supabase
    .from('orders')
    .select('order_number, tariff_id, amount, client_email, client_phone, status, paid_at, created_at')
    .order('created_at', { ascending: false });

  const cols = ['order_number', 'tariff_id', 'amount', 'client_email', 'client_phone', 'status', 'paid_at', 'created_at'];
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = cols.join(',');
  const rows = (orders ?? []).map((o) =>
    cols.map((c) => escape((o as Record<string, unknown>)[c])).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

/**
 * Admin: update lead (status).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';

const ALLOWED_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqClient = createClientFromRequest(request);
  if (!reqClient) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  const { data: { user } } = await reqClient.auth.getUser();
  const { data: profile } = user ? await reqClient.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  if (!user || (profile?.role as string) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = body.status?.trim();
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

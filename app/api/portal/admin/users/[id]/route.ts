/**
 * Admin: update user (role, status).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';

const ALLOWED_ROLES = ['user', 'manager', 'admin'];
const ALLOWED_STATUSES = ['active', 'archived'];

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
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { role?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: { role?: string; status?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (body.role && ALLOWED_ROLES.includes(body.role)) {
    updates.role = body.role;
  }
  if (body.status && ALLOWED_STATUSES.includes(body.status)) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

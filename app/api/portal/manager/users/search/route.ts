/**
 * Manager: search profiles by email or display_name.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';

export async function GET(request: NextRequest) {
  const reqClient = createClientFromRequest(request);
  if (!reqClient) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  const { data: { user } } = await reqClient.auth.getUser();
  const { data: profile } = user ? await reqClient.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  const role = profile?.role as string;
  if (!user || (role !== 'manager' && role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ profiles: [] });

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ profiles: [] });

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, email, role, status, created_at')
    .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(50);

  return NextResponse.json({ profiles: data ?? [] });
}

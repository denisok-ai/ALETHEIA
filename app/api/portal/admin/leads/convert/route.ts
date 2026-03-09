/**
 * Admin: convert lead to user — create auth user and link.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  const reqClient = createClientFromRequest(request);
  if (!reqClient) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  const { data: { user } } = await reqClient.auth.getUser();
  const { data: profile } = user ? await reqClient.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  if (!user || (profile?.role as string) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  let body: { leadId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const leadId = body.leadId;
  if (leadId == null) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, name, email, phone, converted_to_user_id')
    .eq('id', leadId)
    .single();

  if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const l = lead as { converted_to_user_id?: string | null; email?: string | null }; 
  if (l.converted_to_user_id) {
    return NextResponse.json({ error: 'Lead already converted' }, { status: 400 });
  }

  const email = (lead as { email?: string | null }).email?.trim();
  if (!email) {
    return NextResponse.json({ error: 'Lead has no email. Add email to convert.' }, { status: 400 });
  }

  const password = nanoid(16);
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: (lead as { name: string }).name,
      phone: (lead as { phone?: string }).phone,
    },
  });

  if (createErr || !newUser.user) {
    if (createErr?.message?.includes('already been registered')) {
      const { data: existing } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
      const existingId = (existing as { id?: string } | null)?.id;
      if (existingId) {
        await supabase.from('leads').update({
          converted_to_user_id: existingId,
          status: 'converted',
          updated_at: new Date().toISOString(),
        }).eq('id', leadId);
        return NextResponse.json({ userId: existingId, message: 'Linked to existing user' });
      }
    }
    return NextResponse.json({ error: createErr?.message ?? 'Failed to create user' }, { status: 500 });
  }

  await supabase.from('leads').update({
    converted_to_user_id: newUser.user.id,
    status: 'converted',
    updated_at: new Date().toISOString(),
  }).eq('id', leadId);

  return NextResponse.json({
    userId: newUser.user.id,
    message: 'User created. Send password reset link to set password.',
  });
}

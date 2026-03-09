/**
 * Student: create support ticket.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!subject) {
    return NextResponse.json({ error: 'Укажите тему обращения' }, { status: 400 });
  }

  const messages = message ? [{ role: 'user' as const, content: message, at: new Date().toISOString() }] : [];

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      user_id: user.id,
      subject,
      messages,
    })
    .select('id, subject, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ticket });
}

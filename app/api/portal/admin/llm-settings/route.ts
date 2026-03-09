/**
 * Admin: update LLM settings (chatbot).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';

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

  let body: { key: string; provider: string; model: string; system_prompt?: string | null; temperature?: number; max_tokens?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { error } = await supabase
    .from('llm_settings')
    .upsert(
      {
        key: body.key,
        provider: body.provider,
        model: body.model,
        system_prompt: body.system_prompt ?? null,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 2000,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

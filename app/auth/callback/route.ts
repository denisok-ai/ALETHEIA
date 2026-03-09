/**
 * Auth callback: handles email confirmation and password reset tokens from Supabase.
 * Exchange token_hash for session (cookies), then redirect.
 */
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClientWithCookies } from '@/lib/supabase/server-cookies';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next');
  const next = rawNext?.startsWith('/') ? rawNext : (type === 'recovery' ? '/auth/update-password' : '/login');

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  const supabase = await createClientWithCookies();
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=config', request.url));
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}

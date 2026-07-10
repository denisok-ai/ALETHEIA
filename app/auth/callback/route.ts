/**
 * Auth callback — в локальном режиме (NextAuth) не используется.
 * Раньше обрабатывал Supabase OTP (email confirmation, password recovery).
 * Редирект на логин.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

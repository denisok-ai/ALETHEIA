/**
 * Auth callback — в локальном режиме (NextAuth) не используется.
 * Раньше обрабатывал Supabase OTP (email confirmation, password recovery).
 * Редирект на логин.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/login', request.url));
}

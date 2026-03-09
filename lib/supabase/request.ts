/**
 * Create Supabase client from NextRequest (cookies) for API routes.
 */
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

export function createClientFromRequest(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // API route cannot set cookies on response this way; middleware handles refresh
      },
    },
  });
}

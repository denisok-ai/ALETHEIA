import { createBrowserClient } from '@supabase/ssr';

/** Browser Supabase client; session stored in cookies for middleware. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars not set');
  }
  return createBrowserClient(url, key);
}

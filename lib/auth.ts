/**
 * Auth helpers: get user, require role.
 * Used in server components and API routes.
 */
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'user' | 'manager' | 'admin';

export interface Profile {
  id: string;
  role: AppRole;
  status: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  telegram_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Get current user from session (server). Returns null if not authenticated. */
export async function getUser() {
  const supabase = createClient();
  if (!supabase) return { user: null, profile: null };
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, status, display_name, email, avatar_url, telegram_id, created_at, updated_at')
    .eq('id', user.id)
    .single();
  return { user, profile: profile as Profile | null };
}

/** Require auth; redirect or throw. Use in server components. */
export async function requireAuth() {
  const { user, profile } = await getUser();
  if (!user) return null;
  return { user, profile };
}

/** Check if current user has at least one of the given roles. */
export function hasRole(profile: Profile | null, roles: AppRole[]): boolean {
  if (!profile) return false;
  return roles.includes(profile.role as AppRole);
}

/** Require one of the roles; for use after requireAuth. */
export function requireRole(profile: Profile | null, roles: AppRole[]): profile is Profile {
  return hasRole(profile, roles);
}

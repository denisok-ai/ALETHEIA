/**
 * Admin: user catalog (active/archived). TanStack Table + filter.
 */
import { createClient } from '@/lib/supabase/server';
import { UsersTable, type UserRow } from '@/components/portal/UsersTable';

export default async function AdminUsersPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Пользователи</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, status, display_name, email, created_at')
    .order('created_at', { ascending: false });

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email ?? null,
    role: p.role,
    status: p.status,
    display_name: p.display_name ?? null,
    created_at: p.created_at,
  }));

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Пользователи</h1>
      <p className="mt-1 text-text-muted">Каталог пользователей, активные и архивные</p>
      <UsersTable data={rows} />
    </div>
  );
}

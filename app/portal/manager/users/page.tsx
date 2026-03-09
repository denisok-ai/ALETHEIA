/**
 * Manager: user search by email/name (read-only).
 */
import { createClient } from '@/lib/supabase/server';
import { ManagerUserSearch } from './ManagerUserSearch';

export default async function ManagerUsersPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Пользователи</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: initial } = await supabase
    .from('profiles')
    .select('id, display_name, email, role, status, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Пользователи</h1>
      <p className="mt-1 text-text-muted">Поиск и просмотр карточки студента</p>
      <ManagerUserSearch initialProfiles={initial ?? []} />
    </div>
  );
}

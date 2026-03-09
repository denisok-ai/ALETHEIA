/**
 * Student: full list of notifications, mark as read.
 */
import { createClient } from '@/lib/supabase/server';
import { NotificationsList } from './NotificationsList';

export default async function StudentNotificationsPage() {
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Уведомления</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, content, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Уведомления</h1>
      <p className="mt-1 text-text-muted">Все уведомления</p>
      <NotificationsList initialItems={notifications ?? []} />
    </div>
  );
}

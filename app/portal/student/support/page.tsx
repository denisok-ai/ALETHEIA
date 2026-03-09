/**
 * Student: support tickets — list and create.
 */
import { createClient } from '@/lib/supabase/server';
import { SupportTicketsClient } from './SupportTicketsClient';

export default async function StudentSupportPage() {
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Поддержка</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, subject, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Поддержка</h1>
      <p className="mt-1 text-text-muted">Ваши обращения и заявки</p>
      <SupportTicketsClient initialTickets={tickets ?? []} />
    </div>
  );
}

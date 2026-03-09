/**
 * Manager: support tickets from tickets table.
 */
import { createClient } from '@/lib/supabase/server';

export default async function ManagerTicketsPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Тикеты</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, user_id, subject, status, created_at')
    .order('created_at', { ascending: false });

  const list = tickets ?? [];
  const userIds = Array.from(new Set(list.map((t) => (t as { user_id: string }).user_id).filter(Boolean)));
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Тикеты</h1>
      <p className="mt-1 text-text-muted">Заявки поддержки</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">Дата</th>
              <th className="px-4 py-3 font-medium text-dark">Тема</th>
              <th className="px-4 py-3 font-medium text-dark">Пользователь</th>
              <th className="px-4 py-3 font-medium text-dark">Статус</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const p = profileMap.get((t as { user_id: string }).user_id);
              const name = p?.display_name ?? p?.email ?? (t as { user_id: string }).user_id?.slice(0, 8);
              return (
                <tr key={(t as { id: string }).id} className="border-b border-border hover:bg-bg-cream">
                  <td className="px-4 py-3 text-text-muted">
                    {new Date((t as { created_at: string }).created_at).toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-3 font-medium text-dark">{(t as { subject: string }).subject}</td>
                  <td className="px-4 py-3 text-text-muted">{name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        (t as { status: string }).status === 'open'
                          ? 'bg-amber-100 text-amber-800'
                          : (t as { status: string }).status === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {(t as { status: string }).status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Нет тикетов.</p>
      )}
    </div>
  );
}

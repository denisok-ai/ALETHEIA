/**
 * Admin: audit log — who changed what.
 */
import { createClient } from '@/lib/supabase/server';

export default async function AdminAuditPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Журнал аудита</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: logs } = await supabase
    .from('audit_log')
    .select('id, actor_id, action, entity, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const list = logs ?? [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Журнал аудита</h1>
      <p className="mt-1 text-text-muted">Кто что изменил или удалил</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">Дата</th>
              <th className="px-4 py-3 font-medium text-dark">Действие</th>
              <th className="px-4 py-3 font-medium text-dark">Сущность</th>
              <th className="px-4 py-3 font-medium text-dark">ID</th>
              <th className="px-4 py-3 font-medium text-dark">Актор</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={(l as { id: number }).id} className="border-b border-border hover:bg-bg-cream">
                <td className="px-4 py-3 text-text-muted">
                  {new Date((l as { created_at: string }).created_at).toLocaleString('ru')}
                </td>
                <td className="px-4 py-3 font-medium text-dark">{(l as { action: string }).action}</td>
                <td className="px-4 py-3 text-text-muted">{(l as { entity: string }).entity}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">
                  {(l as { entity_id: string | null }).entity_id ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">
                  {(l as { actor_id: string | null }).actor_id?.slice(0, 8) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Журнал пуст.</p>
      )}
    </div>
  );
}

/**
 * Admin: communications — templates list, send form.
 */
import { createClient } from '@/lib/supabase/server';

export default async function AdminCommunicationsPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Коммуникации</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: templates } = await supabase
    .from('comms_templates')
    .select('id, name, channel, subject, created_at')
    .order('name');

  const { data: recentSends } = await supabase
    .from('comms_sends')
    .select('id, channel, recipient, subject, status, sent_at')
    .order('sent_at', { ascending: false })
    .limit(20);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Коммуникации</h1>
      <p className="mt-1 text-text-muted">Рассылки, шаблоны, Telegram</p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-dark">Шаблоны</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-soft">
                <th className="px-4 py-3 font-medium text-dark">Название</th>
                <th className="px-4 py-3 font-medium text-dark">Канал</th>
                <th className="px-4 py-3 font-medium text-dark">Тема</th>
              </tr>
            </thead>
            <tbody>
              {(templates ?? []).map((t) => (
                <tr key={(t as { id: string }).id} className="border-b border-border hover:bg-bg-cream">
                  <td className="px-4 py-3 font-medium text-dark">{(t as { name: string }).name}</td>
                  <td className="px-4 py-3 text-text-muted">{(t as { channel: string }).channel}</td>
                  <td className="px-4 py-3 text-text-muted">{(t as { subject: string | null }).subject ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(templates ?? []).length === 0 && (
          <p className="mt-2 text-sm text-text-muted">Нет шаблонов. Добавьте в таблицу comms_templates.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Последние отправки</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-soft">
                <th className="px-4 py-3 font-medium text-dark">Дата</th>
                <th className="px-4 py-3 font-medium text-dark">Канал</th>
                <th className="px-4 py-3 font-medium text-dark">Получатель</th>
                <th className="px-4 py-3 font-medium text-dark">Статус</th>
              </tr>
            </thead>
            <tbody>
              {(recentSends ?? []).map((s) => (
                <tr key={(s as { id: string }).id} className="border-b border-border hover:bg-bg-cream">
                  <td className="px-4 py-3 text-text-muted">
                    {new Date((s as { sent_at: string }).sent_at).toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{(s as { channel: string }).channel}</td>
                  <td className="px-4 py-3 text-text-muted">{(s as { recipient: string }).recipient}</td>
                  <td className="px-4 py-3 text-text-muted">{(s as { status: string }).status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(recentSends ?? []).length === 0 && (
          <p className="mt-2 text-sm text-text-muted">Нет отправок.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Admin: certificate catalog — all issued certificates.
 */
import { createClient } from '@/lib/supabase/server';

export default async function AdminCertificatesPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Сертификаты</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: certs } = await supabase
    .from('certificates')
    .select('id, user_id, cert_number, issued_at, courses(title)')
    .order('issued_at', { ascending: false });

  const list = certs ?? [];
  const userIds = Array.from(new Set(list.map((c) => c.user_id)));
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Сертификаты</h1>
      <p className="mt-1 text-text-muted">Каталог выданных сертификатов</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">№</th>
              <th className="px-4 py-3 font-medium text-dark">Курс</th>
              <th className="px-4 py-3 font-medium text-dark">Пользователь</th>
              <th className="px-4 py-3 font-medium text-dark">Дата</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const p = profileMap.get(c.user_id);
              const courseTitle = Array.isArray((c as { courses?: unknown }).courses)
                ? (c as { courses: { title?: string }[] }).courses[0]?.title
                : (c as { courses?: { title?: string } }).courses?.title;
              return (
                <tr key={(c as { id: string }).id} className="border-b border-border hover:bg-bg-cream">
                  <td className="px-4 py-3 font-mono text-dark">{(c as { cert_number: string }).cert_number}</td>
                  <td className="px-4 py-3 text-text-muted">{courseTitle ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {p?.display_name ?? p?.email ?? (c as { user_id: string }).user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date((c as { issued_at: string }).issued_at).toLocaleDateString('ru')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="mt-4 text-center text-text-muted">Нет сертификатов.</p>}
    </div>
  );
}

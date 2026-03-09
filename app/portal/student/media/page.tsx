/**
 * Student: mediatheque — video, PDF, audio.
 */
import { createClient } from '@/lib/supabase/server';

export default async function StudentMediaPage() {
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Медиатека</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('media')
    .select('id, title, file_url, mime_type, category')
    .order('sort_order')
    .order('title');

  const list = items ?? [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Медиатека</h1>
      <p className="mt-1 text-text-muted">Видео, материалы и аудио</p>

      {list.length === 0 ? (
        <p className="mt-6 text-text-muted">Пока нет материалов в медиатеке.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {list.map((m: { id: string; title: string; file_url: string; mime_type: string | null; category: string | null }) => (
            <li key={m.id} className="rounded-xl border border-border bg-white p-4">
              <a
                href={(m as { file_url: string }).file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {(m as { title: string }).title}
              </a>
              {(m as { category: string | null }).category && (
                <span className="ml-2 text-xs text-text-muted">{(m as { category: string }).category}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

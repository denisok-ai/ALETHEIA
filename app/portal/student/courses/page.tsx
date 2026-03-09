/**
 * Student: list of enrolled courses with progress.
 */
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function StudentCoursesPage() {
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Мои курсы</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrolled_at,
      courses ( id, title, description, thumbnail_url )
    `)
    .eq('user_id', user.id)
    .order('enrolled_at', { ascending: false });

  const list = enrollments ?? [];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Мои курсы</h1>
      <p className="mt-1 text-text-muted">Курсы, на которые вы записаны</p>

      {list.length === 0 ? (
        <p className="mt-6 text-text-muted">
          У вас пока нет записей на курсы. <Link href="/#pricing" className="text-primary hover:underline">Перейти к тарифам</Link>
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => {
            const raw = e as { id: string; courses: { id: string; title: string; description: string | null; thumbnail_url: string | null } | { id: string; title: string; description: string | null; thumbnail_url: string | null }[] };
            const c = Array.isArray(raw.courses) ? raw.courses[0] : raw.courses;
            if (!c) return null;
            return (
              <li key={raw.id}>
                <Link
                  href={`/portal/student/courses/${c.id}`}
                  className="block rounded-xl border border-border bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  {c.thumbnail_url && (
                    <div className="aspect-video w-full overflow-hidden rounded-lg bg-bg-soft">
                      <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h2 className="mt-3 font-semibold text-dark">{c.title}</h2>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{c.description}</p>}
                  <span className="mt-2 inline-block text-sm text-primary">Открыть курс →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Student dashboard: progress overview, recent activity, notifications preview.
 */
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function StudentDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Дашборд</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const [enrollmentsRes, notificationsRes, energyRes] = await Promise.all([
    supabase.from('enrollments').select('id, enrolled_at, courses(title, thumbnail_url)').eq('user_id', user.id).order('enrolled_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('id, type, content, is_read, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('user_energy').select('xp, level, last_practice_at').eq('user_id', user.id).maybeSingle(),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const notifications = notificationsRes.data ?? [];
  const energy = energyRes.data ?? { xp: 0, level: 1, last_practice_at: null };
  const xp = energy.xp ?? 0;
  const level = energy.level ?? 1;
  const xpForNextLevel = 100;
  const progressToNext = (xp % xpForNextLevel) / xpForNextLevel;

  const BADGES = [
    { minXp: 0, label: 'Новичок', emoji: '🌱' },
    { minXp: 50, label: 'Практик', emoji: '💪' },
    { minXp: 100, label: 'Уверенный', emoji: '⭐' },
    { minXp: 200, label: 'Мастер', emoji: '🏆' },
    { minXp: 500, label: 'Эксперт', emoji: '👑' },
  ];
  const earnedBadges = BADGES.filter((b) => xp >= b.minXp);
  const nextBadge = BADGES.find((b) => xp < b.minXp);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Дашборд</h1>
      <p className="mt-1 text-text-muted">Обзор обучения и активность</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Шкала Энергии</h2>
        <p className="mt-1 text-sm text-text-muted">XP за практики мышечного тестирования</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20 font-bold text-secondary">
            {level}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <span className="text-dark">{xp} XP</span>
              <span className="text-text-muted">Уровень {level}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-soft">
              <div
                className="h-full rounded-full bg-secondary transition-all"
                style={{ width: `${progressToNext * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-dark">Бейджи</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {earnedBadges.map((b) => (
              <span
                key={b.minXp}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/20 px-3 py-1 text-sm font-medium text-secondary"
                title={b.label}
              >
                <span>{b.emoji}</span>
                <span>{b.label}</span>
              </span>
            ))}
            {nextBadge && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-text-muted"
                title={`Ещё ${nextBadge.minXp - xp} XP до «${nextBadge.label}»`}
              >
                <span>{nextBadge.emoji}</span>
                <span>{nextBadge.label}</span>
                <span className="text-xs">({nextBadge.minXp - xp} XP)</span>
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Мои курсы</h2>
        {enrollments.length === 0 ? (
          <p className="mt-2 text-text-muted">Пока нет записей на курсы. <Link href="/#pricing" className="text-primary hover:underline">Выбрать курс</Link></p>
        ) : (
          <ul className="mt-3 space-y-2">
            {enrollments.map((e) => {
              const raw = e as { id: string; courses: { title: string } | { title: string }[] };
              const title = Array.isArray(raw.courses) ? raw.courses[0]?.title : raw.courses?.title;
              return (
                <li key={raw.id}>
                  <Link href="/portal/student/courses" className="text-primary hover:underline">
                    {title ?? 'Курс'}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Уведомления</h2>
        {notifications.length === 0 ? (
          <p className="mt-2 text-text-muted">Нет новых уведомлений</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.map((n: { id: string; type: string; content: unknown; is_read: boolean; created_at: string }) => (
              <li key={n.id} className="rounded-lg border border-border bg-white p-3">
                <span className="text-sm font-medium text-dark">{n.type}</span>
                <p className="text-sm text-text-muted">{String((n.content as { text?: string })?.text ?? '')}</p>
                <time className="text-xs text-text-soft">{new Date(n.created_at).toLocaleDateString('ru')}</time>
              </li>
            ))}
          </ul>
        )}
        <Link href="/portal/student/notifications" className="mt-2 inline-block text-sm text-primary hover:underline">Все уведомления →</Link>
      </section>
    </div>
  );
}

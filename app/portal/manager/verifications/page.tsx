/**
 * Manager: Phygital homework verification queue — approve/reject.
 */
import { createClient } from '@/lib/supabase/server';
import { VerificationsList } from './VerificationsList';

export default async function ManagerVerificationsPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Верификация заданий</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('phygital_verifications')
    .select('id, user_id, course_id, lesson_id, video_url, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const list = items ?? [];
  const userIds = Array.from(new Set(list.map((i) => i.user_id)));
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Верификация заданий</h1>
      <p className="mt-1 text-text-muted">Очередь видео на проверку, одобрить / отклонить</p>
      <VerificationsList items={list} profileMap={Object.fromEntries(profileMap)} />
    </div>
  );
}

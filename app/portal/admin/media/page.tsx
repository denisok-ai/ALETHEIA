/**
 * Admin: mediatheque — list and upload.
 */
import { createClient } from '@/lib/supabase/server';
import { MediaAdminClient } from './MediaAdminClient';

export default async function AdminMediaPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Медиатека</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('media')
    .select('id, title, file_url, mime_type, category, created_at')
    .order('sort_order')
    .order('title');

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Медиатека</h1>
      <p className="mt-1 text-text-muted">Загрузка и управление медиафайлами</p>
      <MediaAdminClient initialItems={items ?? []} />
    </div>
  );
}

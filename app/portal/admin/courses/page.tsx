/**
 * Admin: course catalog, create course, upload SCORM.
 */
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CoursesAdminClient } from './CoursesAdminClient';

export default async function AdminCoursesPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Курсы</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, scorm_path, thumbnail_url, status, price, created_at')
    .order('sort_order')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Курсы</h1>
      <p className="mt-1 text-text-muted">Каталог курсов и мероприятий, загрузка SCORM</p>
      <CoursesAdminClient initialCourses={courses ?? []} />
    </div>
  );
}

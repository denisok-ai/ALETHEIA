/**
 * Student: course detail and link to SCORM player.
 */
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return <p className="text-text-muted">Загрузка…</p>;
  }

  const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (!course) notFound();

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single();

  if (!enrollment) {
    return (
      <div>
        <p className="text-text-muted">У вас нет доступа к этому курсу.</p>
        <Link href="/portal/student/courses" className="mt-2 inline-block text-primary hover:underline">← К моим курсам</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/portal/student/courses" className="text-sm text-primary hover:underline">← Мои курсы</Link>
      <h1 className="mt-4 font-heading text-2xl font-bold text-dark">{course.title}</h1>
      {course.description && <p className="mt-2 text-text-muted">{course.description}</p>}
      <div className="mt-6">
        <Link
          href={`/portal/student/courses/${courseId}/play`}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90"
        >
          Открыть курс (плеер)
        </Link>
      </div>
    </div>
  );
}

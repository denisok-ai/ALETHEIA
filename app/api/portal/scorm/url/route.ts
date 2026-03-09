/**
 * Returns a (signed) URL for the SCORM package entry point (e.g. index.html in Storage).
 * Course.scorm_path is the storage path (e.g. courses/course-id/index.html).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single();

  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });

  const { data: course } = await supabase.from('courses').select('scorm_path').eq('id', courseId).single();
  if (!course?.scorm_path) return NextResponse.json({ error: 'No SCORM content' }, { status: 404 });

  const { data: signed } = await supabase.storage.from('scorm').createSignedUrl(course.scorm_path, 3600);
  if (!signed?.signedUrl) return NextResponse.json({ error: 'URL generation failed' }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl });
}

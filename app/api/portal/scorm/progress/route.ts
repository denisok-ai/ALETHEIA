/**
 * SCORM progress API: get/set CMI data for a user/course/lesson.
 * Used by the SCORM player to persist state.
 * Auto-issues certificate when completion_status is "completed" and no cert exists.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

async function maybeIssueCertificate(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  userId: string,
  courseId: string
) {
  const { data: existing } = await supabase
    .from('certificates')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (existing) return;

  const [{ data: profile }, { data: course }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).single(),
    supabase.from('courses').select('title').eq('id', courseId).single(),
  ]);
  const displayName = (profile as { display_name?: string } | null)?.display_name ?? 'Слушатель';
  const courseTitle = (course as { title?: string } | null)?.title ?? 'Курс';
  const certNumber = `ALT-${nanoid(8).toUpperCase()}`;

  await supabase.from('certificates').insert({
    user_id: userId,
    course_id: courseId,
    cert_number: certNumber,
  });

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'certificate_issued',
    content: { course_id: courseId, cert_number: certNumber },
  });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const lessonId = searchParams.get('lessonId');
  if (!courseId || !lessonId) return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });

  const { data, error } = await supabase
    .from('scorm_progress')
    .select('cmi_data, completion_status, score, time_spent')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId)
    .single();

  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { cmi_data: {}, completion_status: null, score: null, time_spent: 0 });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { courseId: string; lessonId: string; cmi_data?: Record<string, unknown>; completion_status?: string; score?: number; time_spent?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { courseId, lessonId, cmi_data = {}, completion_status, score, time_spent } = body;
  if (!courseId || !lessonId) return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });

  const { error } = await supabase.from('scorm_progress').upsert(
    {
      user_id: user.id,
      course_id: courseId,
      lesson_id: lessonId,
      cmi_data,
      completion_status: completion_status ?? null,
      score: score ?? null,
      time_spent: time_spent ?? 0,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'user_id,course_id,lesson_id' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (completion_status === 'completed') {
    try {
      await maybeIssueCertificate(supabase, user.id, courseId);
    } catch (e) {
      console.error('Auto-certificate error:', e);
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * Admin: upload SCORM ZIP; extract and store in Supabase Storage bucket "scorm".
 * Expects multipart form with "file" (ZIP) and "courseId".
 */
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';

export async function POST(request: NextRequest) {
  const reqClient = createClientFromRequest(request);
  if (!reqClient) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  const { data: { user } } = await reqClient.auth.getUser();
  const { data: profile } = user ? await reqClient.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  if (!user || (profile?.role as string) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const courseId = formData.get('courseId') as string | null;
  if (!file || !courseId) {
    return NextResponse.json({ error: 'Missing file or courseId' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const prefix = `courses/${courseId}`;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const content = await entry.async('arraybuffer');
    const storagePath = `${prefix}/${path}`;
    const { error } = await supabase.storage.from('scorm').upload(storagePath, content, {
      contentType: path.endsWith('.html') ? 'text/html' : path.endsWith('.xml') ? 'application/xml' : 'application/octet-stream',
      upsert: true,
    });
    if (error) {
      console.error('Upload error', storagePath, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const entryPath = `${prefix}/index.html`;
  const { data: updateData, error: updateErr } = await supabase
    .from('courses')
    .update({ scorm_path: entryPath, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .select('id')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, courseId: updateData?.id });
}

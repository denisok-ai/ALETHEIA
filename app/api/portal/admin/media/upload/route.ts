/**
 * Admin: upload media file to Storage and insert into media table.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromRequest } from '@/lib/supabase/request';
import { nanoid } from 'nanoid';

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
  const title = (formData.get('title') as string)?.trim() || null;
  const category = (formData.get('category') as string)?.trim() || null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeName = `${nanoid(10)}.${ext}`;
  const path = `uploads/${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from('media')
    .upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Storage upload:', uploadErr);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
  const fileUrl = urlData?.publicUrl ?? '';

  const displayTitle = title || file.name;

  const { data: media, error: insertErr } = await supabase
    .from('media')
    .insert({
      title: displayTitle,
      file_url: fileUrl,
      mime_type: file.type || null,
      category: category || null,
      owner_id: user.id,
    })
    .select('id, title, file_url, mime_type, category, created_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ media });
}

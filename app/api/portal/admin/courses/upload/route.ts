/**
 * Admin: upload SCORM ZIP; extract, parse manifest, extract text for AI; store in public/uploads/scorm/.
 * Creates ScormVersion record. Keeps last 5 versions on disk.
 * Expects multipart form with "file" (ZIP) and "courseId".
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { getScormMaxSizeMb } from '@/lib/settings';
import { installScormZip, ScormZipTooLargeError } from '@/lib/scorm/install-scorm-zip';

/** Долгая распаковка больших ZIP на VPS */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const courseId = formData.get('courseId') as string | null;
    if (!file || !courseId) {
      return NextResponse.json({ error: 'Missing file or courseId' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { scormPath, version, scormVersion } = await installScormZip({
      courseId,
      buffer: buf,
      uploadedById: auth.userId,
      fileSize: file.size,
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: 'scorm_upload',
      entity: 'Course',
      entityId: courseId,
      diff: { scormPath, scormVersion, version },
    });

    return NextResponse.json({ success: true, courseId, scormPath, version });
  } catch (e) {
    if (e instanceof ScormZipTooLargeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('SCORM upload error:', e);
    const maxMb = await getScormMaxSizeMb().catch(() => 200);
    return NextResponse.json(
      { error: `Ошибка загрузки SCORM: ${msg}. Проверьте файл (ZIP, до ${maxMb} МБ) и повторите.` },
      { status: 500 }
    );
  }
}

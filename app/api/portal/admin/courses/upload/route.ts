/**
 * Admin: upload SCORM ZIP; extract, parse manifest, extract text for AI; store in public/uploads/scorm/.
 * Expects multipart form with "file" (ZIP) and "courseId".
 */
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { parseScormManifest } from '@/lib/scorm/manifest-parser';
import { extractCourseContent } from '@/lib/scorm/course-content-extractor';
import { writeAuditLog } from '@/lib/audit';

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
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buf);
    } catch {
      return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
    }

    const prefix = path.join(process.cwd(), 'public', 'uploads', 'scorm', `courses-${courseId}`);
    await mkdir(prefix, { recursive: true });

    // Extract all files
    const htmlEntries: { path: string; content: string }[] = [];
    for (const [filePath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const content = await entry.async('nodebuffer');
      const fullPath = path.join(prefix, filePath);
      const dir = path.dirname(fullPath);
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);

      const lower = filePath.toLowerCase();
      if (lower.endsWith('.html')) {
        htmlEntries.push({ path: filePath, content: content.toString('utf-8') });
      }
    }

    // Parse manifest
    const manifestEntry = Object.keys(zip.files).find(
      (p) => p.toLowerCase() === 'imsmanifest.xml' || p.toLowerCase().endsWith('/imsmanifest.xml')
    );
    let scormVersion: string | null = null;
    let scormManifest: string | null = null;
    let aiContext: string | null = null;

    if (manifestEntry) {
      try {
        const xmlContent = (await zip.files[manifestEntry].async('string')) as string;
        const parsed = parseScormManifest(xmlContent);
        if (parsed) {
          scormVersion = parsed.version;
          scormManifest = JSON.stringify({
            version: parsed.version,
            title: parsed.title,
            items: parsed.items,
          });
        }
      } catch (e) {
        console.error('SCORM manifest parse error:', e);
        // Continue without manifest; course still usable
      }
    }

    // Extract text for AI context
    if (htmlEntries.length > 0) {
      const extracted = extractCourseContent(htmlEntries);
      if (extracted.length > 0) {
        aiContext = JSON.stringify(extracted);
      }
    }

    // Entry point for iframe
    const indexHtml = Object.keys(zip.files).find((p) => p.toLowerCase().endsWith('index.html'));
    const firstHtml = Object.keys(zip.files).find((p) => p.toLowerCase().endsWith('.html'));
    const entryPath = indexHtml ?? firstHtml ?? 'index.html';
    const scormPath = `courses-${courseId}/${entryPath}`;

    await prisma.course.update({
      where: { id: courseId },
      data: {
        scormPath,
        scormVersion,
        scormManifest,
        aiContext,
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: 'scorm_upload',
      entity: 'Course',
      entityId: courseId,
      diff: { scormPath, scormVersion },
    });

    return NextResponse.json({ success: true, courseId, scormPath });
  } catch (e) {
    console.error('SCORM upload error:', e);
    return NextResponse.json(
      { error: 'Ошибка загрузки SCORM. Проверьте файл и повторите попытку.' },
      { status: 500 }
    );
  }
}

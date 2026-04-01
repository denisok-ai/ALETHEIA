/**
 * Admin: upload SCORM ZIP; extract, parse manifest, extract text for AI; store in public/uploads/scorm/.
 * Creates ScormVersion record. Keeps last 5 versions on disk.
 * Expects multipart form with "file" (ZIP) and "courseId".
 */
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { parseScormManifest, type ParsedManifest } from '@/lib/scorm/manifest-parser';
import { pickScormEntryPath } from '@/lib/scorm/launch-path';
import { extractCourseContent } from '@/lib/scorm/course-content-extractor';
import { writeAuditLog } from '@/lib/audit';
import { getScormMaxSizeMb } from '@/lib/settings';

const MAX_VERSIONS_KEPT = 5;

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
    const maxMb = await getScormMaxSizeMb();
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Размер архива не более ${maxMb} МБ` },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buf);
    } catch {
      return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
    }

    const lastVersion = await prisma.scormVersion.findFirst({
      where: { courseId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const versionDir = `v${nextVersion}`;
    const prefix = path.join(process.cwd(), 'public', 'uploads', 'scorm', `courses-${courseId}`, versionDir);
    await mkdir(prefix, { recursive: true });

    const resolvedPrefix = path.resolve(prefix);

    const htmlEntries: { path: string; content: string }[] = [];
    for (const [filePath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const fullPath = path.join(prefix, filePath);
      const resolvedFull = path.resolve(fullPath);
      if (!resolvedFull.startsWith(resolvedPrefix)) {
        continue;
      }
      const content = await entry.async('nodebuffer');
      const dir = path.dirname(fullPath);
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);

      const lower = filePath.toLowerCase();
      if (lower.endsWith('.html')) {
        htmlEntries.push({ path: filePath, content: content.toString('utf-8') });
      }
    }

    const manifestEntry = Object.keys(zip.files).find(
      (p) => p.toLowerCase() === 'imsmanifest.xml' || p.toLowerCase().endsWith('/imsmanifest.xml')
    );
    let scormVersionStr: string | null = null;
    let scormManifest: string | null = null;
    let aiContext: string | null = null;
    let parsedManifest: ParsedManifest | null = null;

    if (manifestEntry) {
      try {
        const xmlContent = (await zip.files[manifestEntry].async('string')) as string;
        const parsed = parseScormManifest(xmlContent);
        parsedManifest = parsed;
        if (parsed) {
          scormVersionStr = parsed.version;
          scormManifest = JSON.stringify({
            version: parsed.version,
            title: parsed.title,
            items: parsed.items,
          });
        }
      } catch (e) {
        console.error('SCORM manifest parse error:', e);
      }
    }

    if (htmlEntries.length > 0) {
      const extracted = extractCourseContent(htmlEntries);
      if (extracted.length > 0) {
        aiContext = JSON.stringify(extracted);
      }
    }

    const entryPath = pickScormEntryPath(zip, manifestEntry, parsedManifest);
    const scormPath = `courses-${courseId}/${versionDir}/${entryPath}`;

    await prisma.$transaction(async (tx) => {
      await tx.scormVersion.updateMany({
        where: { courseId },
        data: { isActive: false },
      });

      await tx.scormVersion.create({
        data: {
          courseId,
          version: nextVersion,
          scormPath,
          scormVersion: scormVersionStr,
          scormManifest,
          aiContext,
          fileSize: file.size,
          isActive: true,
          uploadedById: auth.userId,
        },
      });

      await tx.course.update({
        where: { id: courseId },
        data: {
          scormPath,
          scormVersion: scormVersionStr,
          scormManifest,
          aiContext,
        },
      });
    });

    const toRemove = await prisma.scormVersion.findMany({
      where: { courseId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, scormPath: true },
    });
    const toDelete = toRemove.slice(MAX_VERSIONS_KEPT);
    for (const v of toDelete) {
      const dirPart = path.dirname(v.scormPath);
      if (!/\/v\d+$/.test(dirPart)) continue;
      const dirPath = path.join(process.cwd(), 'public', 'uploads', 'scorm', dirPart);
      try {
        await rm(dirPath, { recursive: true });
      } catch (err) {
        console.error('Failed to remove old SCORM version dir:', dirPath, err);
      }
      await prisma.scormVersion.delete({ where: { id: v.id } });
    }

    await writeAuditLog({
      actorId: auth.userId,
      action: 'scorm_upload',
      entity: 'Course',
      entityId: courseId,
      diff: { scormPath, scormVersion: scormVersionStr, version: nextVersion },
    });

    return NextResponse.json({ success: true, courseId, scormPath, version: nextVersion });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('SCORM upload error:', e);
    const maxMb = await getScormMaxSizeMb().catch(() => 200);
    return NextResponse.json(
      { error: `Ошибка загрузки SCORM: ${msg}. Проверьте файл (ZIP, до ${maxMb} МБ) и повторите.` },
      { status: 500 }
    );
  }
}

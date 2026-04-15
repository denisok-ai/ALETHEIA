/**
 * Установка SCORM из ZIP: распаковка, парсинг манифеста, запись в public/uploads/scorm/, Course + ScormVersion.
 * Используется API загрузки админки и скрипты импорта (seed / npm run scorm:import-demo).
 */
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { parseScormManifest, type ParsedManifest } from '@/lib/scorm/manifest-parser';
import { pickScormEntryPath } from '@/lib/scorm/launch-path';
import { extractCourseContent } from '@/lib/scorm/course-content-extractor';
import { applyScormVideoOverrides } from '@/lib/scorm/apply-video-overrides';

const MAX_VERSIONS_KEPT = 5;
const DEFAULT_SCORM_MAX_MB = 200;
/** Верхняя граница для значения из настроек (архивы с видео могут быть 1–2+ ГБ). */
const SCORM_MAX_SIZE_MB_HARD_CAP = 3000;

/** Без импорта lib/settings (там React cache — ломает tsx-скрипты). */
async function getScormMaxSizeMbForZip(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: 'scorm_max_size_mb' },
  });
  const parsed = row?.value ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, SCORM_MAX_SIZE_MB_HARD_CAP)
    : DEFAULT_SCORM_MAX_MB;
}

export type InstallScormZipResult = {
  scormPath: string;
  version: number;
  scormVersion: string | null;
};

export class ScormZipTooLargeError extends Error {
  constructor(maxMb: number) {
    super(`Размер архива не более ${maxMb} МБ`);
    this.name = 'ScormZipTooLargeError';
  }
}

/**
 * Распаковывает SCORM ZIP для курса: новая версия vN, предыдущие версии деактивируются; старше 5 версий — удаляются с диска.
 */
export async function installScormZip(opts: {
  courseId: string;
  buffer: Buffer;
  uploadedById?: string | null;
  fileSize?: number;
}): Promise<InstallScormZipResult> {
  const { courseId, buffer } = opts;
  const fileSize = opts.fileSize ?? buffer.length;

  const maxMb = await getScormMaxSizeMbForZip();
  const maxBytes = maxMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    throw new ScormZipTooLargeError(maxMb);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Invalid ZIP file');
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

  await applyScormVideoOverrides(prefix).catch((e) => {
    console.warn('[SCORM] applyScormVideoOverrides:', e);
  });

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
        fileSize,
        isActive: true,
        uploadedById: opts.uploadedById ?? null,
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

  return { scormPath, version: nextVersion, scormVersion: scormVersionStr };
}

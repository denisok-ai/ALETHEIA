/**
 * Установка SCORM-пакета в курс из УЖЕ РАСПАКОВАННОГО каталога (без ZIP).
 *
 * Зачем: полный курс может весить 1–2 ГБ — гонять его через JSZip в памяти
 * (как installScormZip) на проде нельзя. Этот скрипт копирует каталог на диске
 * и повторяет остальной конвейер установки: video-overrides, font-алиасы,
 * парсинг манифеста, aiContext для AI-тьютора, ScormVersion + Course.
 *
 * Кейс-первопричина (2026-08-11): во все боевые курсы был установлен
 * demo-пакет, а полный лежал распакованным в отладочном «Пробном 2».
 *
 *   npx tsx scripts/scorm-install-from-dir.ts --course=course-avaterra-praktik \
 *     --src=/opt/ALETHEIA/public/uploads/scorm/courses-course-probnyy-2/v1 [--dry]
 *
 * Откат: у курса остаются прежние версии — вернуть можно, переключив
 * Course.scormPath/scormVersion/scormManifest/aiContext на строку ScormVersion vN
 * (и isActive) — см. таблицу ScormVersion.
 */
import { cp, mkdir, readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { parseScormManifest, type ParsedManifest } from '../lib/scorm/manifest-parser';
import { pickScormEntryPath } from '../lib/scorm/launch-path';
import { extractCourseContent } from '../lib/scorm/course-content-extractor';
import { applyScormVideoOverrides } from '../lib/scorm/apply-video-overrides';
import { fixTemplateFontAliases } from '../lib/scorm/fix-template-font-aliases';

function parseArgs() {
  let courseId = '';
  let src = '';
  let dry = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--course=')) courseId = a.slice(9).trim();
    else if (a.startsWith('--src=')) src = a.slice(6).trim();
    else if (a === '--dry') dry = true;
  }
  return { courseId, src, dry };
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop()!;
    const entries = await readdir(path.join(root, rel), { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) stack.push(childRel);
      else if (e.isFile()) out.push(childRel);
    }
  }
  return out;
}

async function main() {
  const { courseId, src, dry } = parseArgs();
  if (!courseId || !src) {
    console.error(
      'Использование: npx tsx scripts/scorm-install-from-dir.ts --course=<courseId> --src=<каталог распакованного SCORM> [--dry]'
    );
    process.exit(1);
  }
  const srcAbs = path.resolve(src);
  if (!existsSync(path.join(srcAbs, 'imsmanifest.xml'))) {
    console.error('В каталоге нет imsmanifest.xml:', srcAbs);
    process.exit(1);
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    console.error('Курс не найден:', courseId);
    process.exit(1);
  }

  const manifestXml = await readFile(path.join(srcAbs, 'imsmanifest.xml'), 'utf-8');
  const parsed: ParsedManifest | null = parseScormManifest(manifestXml);
  const title = parsed?.title ?? null;

  const lastVersion = await prisma.scormVersion.findFirst({
    where: { courseId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;
  const versionDir = `v${nextVersion}`;
  const destAbs = path.join(
    process.cwd(),
    'public',
    'uploads',
    'scorm',
    `courses-${courseId}`,
    versionDir
  );

  console.log(`Курс:        ${courseId} (${course.title})`);
  console.log(`Источник:    ${srcAbs}`);
  console.log(`Назначение:  ${destAbs}`);
  console.log(`Версия:      v${nextVersion}`);
  console.log(`Манифест:    ${title ?? '(title не распознан)'} / SCORM ${parsed?.version ?? '?'}`);

  if (existsSync(destAbs)) {
    console.error('Каталог назначения уже существует — прерываюсь.');
    process.exit(1);
  }
  if (dry) {
    console.log('[dry] Копирование и запись в БД пропущены.');
    return;
  }

  await mkdir(path.dirname(destAbs), { recursive: true });
  console.log('Копирую файлы…');
  await cp(srcAbs, destAbs, { recursive: true });

  await applyScormVideoOverrides(destAbs).catch((e) => {
    console.warn('[SCORM] applyScormVideoOverrides:', e);
  });
  const fontAliases = await fixTemplateFontAliases(destAbs).catch((e) => {
    console.warn('[SCORM] fixTemplateFontAliases:', e);
    return 0;
  });
  if (fontAliases > 0) console.info(`[SCORM] font aliases created: ${fontAliases}`);

  const relFiles = await walkFiles(destAbs);
  let fileSize = 0;
  for (const rel of relFiles) {
    fileSize += (await stat(path.join(destAbs, rel))).size;
  }

  const htmlEntries: { path: string; content: string }[] = [];
  for (const rel of relFiles) {
    if (rel.toLowerCase().endsWith('.html')) {
      htmlEntries.push({ path: rel, content: await readFile(path.join(destAbs, rel), 'utf-8') });
    }
  }
  const extracted = extractCourseContent(htmlEntries);
  const aiContext = extracted.length > 0 ? JSON.stringify(extracted) : null;

  const zipLike = { files: Object.fromEntries(relFiles.map((p) => [p, { dir: false }])) };
  const entryPath = pickScormEntryPath(zipLike, 'imsmanifest.xml', parsed);
  const scormPath = `courses-${courseId}/${versionDir}/${entryPath}`;

  const scormVersionStr = parsed?.version ?? null;
  const scormManifest = parsed
    ? JSON.stringify({ version: parsed.version, title: parsed.title, items: parsed.items })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.scormVersion.updateMany({ where: { courseId }, data: { isActive: false } });
    await tx.scormVersion.create({
      data: {
        courseId,
        version: nextVersion,
        scormPath,
        scormVersion: scormVersionStr,
        scormManifest,
        aiContext,
        fileSize,
        notes: `Установлен из каталога ${srcAbs}`,
        isActive: true,
      },
    });
    await tx.course.update({
      where: { id: courseId },
      data: { scormPath, scormVersion: scormVersionStr, scormManifest, aiContext },
    });
  });

  console.log('Готово.');
  console.log(`scormPath:  ${scormPath}`);
  console.log(`fileSize:   ${(fileSize / 1024 / 1024).toFixed(0)} МБ, файлов: ${relFiles.length}`);
  console.log(`aiContext:  ${extracted.length} урок(ов) извлечено для AI-тьютора`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * SCORM demo-пакеты часто содержат файлы в templates/ под UUID-именами,
 * а defaultData.js ссылается на hash__Name.ext — создаём hardlink-алиасы.
 */
import { existsSync } from 'fs';
import { readFile, readdir, link, stat } from 'fs/promises';
import path from 'path';

type AliasMap = Record<string, string>;

function parseExpectedTemplatePaths(defaultDataJs: string): Record<string, number> {
  const pathSize: Record<string, number> = {};
  const re = /"path"\s*:\s*"\.\/templates\/([^"]+)"[\s\S]{0,300}?"size"\s*:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(defaultDataJs)) !== null) {
    pathSize[m[1]] = parseInt(m[2], 10);
  }
  return pathSize;
}

function buildAliasMap(pathSize: Record<string, number>, zipBasenames: Record<string, number>): AliasMap {
  const aliases: AliasMap = {};
  const zipBySize = new Map<number, string[]>();
  for (const [name, size] of Object.entries(zipBasenames)) {
    const list = zipBySize.get(size) ?? [];
    list.push(name);
    zipBySize.set(size, list);
  }

  for (const [expected, size] of Object.entries(pathSize)) {
    if (!expected.includes('__')) continue;
    if (expected in zipBasenames) continue;
    const matches = zipBySize.get(size) ?? [];
    if (matches.length === 1) {
      aliases[expected] = matches[0]!;
    }
  }

  for (const expected of Object.keys(pathSize)) {
    if (!expected.endsWith('.woff') || !expected.includes('__')) continue;
    if (expected in aliases || expected in zipBasenames) continue;
    const suffix = expected.split('__').slice(1).join('__');
    const woff2Name = suffix.replace(/\.woff$/, '.woff2');
    const woff2Key = Object.keys(aliases).find((k) => k.endsWith(`__${woff2Name}`));
    if (woff2Key) {
      aliases[expected] = aliases[woff2Key]!;
    }
  }

  const uuidByExt = new Map<string, string[]>();
  for (const name of Object.keys(zipBasenames)) {
    if (name.includes('__')) continue;
    const ext = path.extname(name).toLowerCase();
    const list = uuidByExt.get(ext) ?? [];
    list.push(name);
    uuidByExt.set(ext, list);
  }

  for (const expected of Object.keys(pathSize)) {
    if (!expected.includes('__')) continue;
    if (expected in zipBasenames || expected in aliases) continue;
    const ext = path.extname(expected).toLowerCase();
    const candidates = uuidByExt.get(ext) ?? [];
    if (candidates.length === 1) {
      aliases[expected] = candidates[0]!;
    }
  }

  return aliases;
}

/** Создаёт hardlink templates/<alias> → templates/<uuid>, если alias отсутствует. */
export async function fixTemplateFontAliases(packageRootAbsPath: string): Promise<number> {
  const defaultDataPath = path.join(packageRootAbsPath, 'defaultData.js');
  const templatesDir = path.join(packageRootAbsPath, 'templates');
  if (!existsSync(defaultDataPath) || !existsSync(templatesDir)) {
    return 0;
  }

  const defaultDataJs = await readFile(defaultDataPath, 'utf-8');
  const pathSize = parseExpectedTemplatePaths(defaultDataJs);

  const entries = await readdir(templatesDir, { withFileTypes: true });
  const zipBasenames: Record<string, number> = {};
  for (const e of entries) {
    if (!e.isFile()) continue;
    const fileStat = await stat(path.join(templatesDir, e.name));
    zipBasenames[e.name] = fileStat.size;
  }

  const aliases = buildAliasMap(pathSize, zipBasenames);
  let created = 0;

  for (const [aliasName, sourceName] of Object.entries(aliases)) {
    const aliasPath = path.join(templatesDir, aliasName);
    const sourcePath = path.join(templatesDir, sourceName);
    if (existsSync(aliasPath) || !existsSync(sourcePath)) continue;
    try {
      await link(sourcePath, aliasPath);
      created += 1;
    } catch (err) {
      console.warn('[SCORM] asset alias link failed:', aliasName, err);
    }
  }

  return created;
}

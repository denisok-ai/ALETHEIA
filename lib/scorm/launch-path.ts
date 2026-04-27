/**
 * Выбор HTML entry point SCORM-пакета: приоритет — первый SCO с href из манифеста (относительно папки imsmanifest.xml).
 */
import type { ParsedManifest } from '@/lib/scorm/manifest-parser';

type ZipLike = { files: Record<string, { dir?: boolean }> };

export function pickScormEntryPath(
  zip: ZipLike,
  manifestEntry: string | undefined,
  parsed: ParsedManifest | null
): string {
  const keys = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  const has = (p: string) => {
    const n = norm(p);
    return keys.some((k) => norm(k) === n);
  };

  if (manifestEntry && parsed?.items?.length) {
    const dir = manifestEntry.includes('/')
      ? manifestEntry.slice(0, manifestEntry.lastIndexOf('/'))
      : '';
    const withDir = (href: string) => {
      const h = norm(href);
      return dir ? norm(`${dir}/${h}`) : h;
    };
    for (const it of parsed.items) {
      const href = it.href?.trim();
      if (!href) continue;
      const candidate = withDir(href);
      if (has(candidate)) return candidate;
    }
  }

  const indexHtml = keys.find((p) => p.toLowerCase().endsWith('index.html'));
  if (indexHtml) return indexHtml;
  const firstHtml = keys.find((p) => p.toLowerCase().endsWith('.html'));
  if (firstHtml) return firstHtml;
  return 'index.html';
}

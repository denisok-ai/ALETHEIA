/**
 * Извлечение courseId из пути статики SCORM: /uploads/scorm/courses-{id}/...
 */
export function courseIdFromScormAssetPath(pathname: string): string | null {
  const m = pathname.match(/\/uploads\/scorm\/courses-([^/]+)\//);
  return m?.[1] ?? null;
}

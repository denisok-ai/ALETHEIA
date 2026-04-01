/**
 * Валидация отправки задания на верификацию: видео (URL/файл) или текстовый ответ.
 */
export function isValidVideoSubmissionUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length > 2000) return false;
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/uploads/');
}

export function isValidTextSubmission(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 20000;
}

/**
 * Валидация отправки задания на верификацию: видео (URL/файл) или текстовый ответ.
 */
export function isValidVideoSubmissionUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length > 2000) return false;
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/uploads/');
}

/** URL или путь, по которому менеджер реально открывает ролик (не якорь/страница портала). */
export function isOpenableVideoMaterialUrl(s: string): boolean {
  const t = (s || '').trim();
  if (!t) return false;
  if (t.startsWith('http://') || t.startsWith('https://')) return true;
  if (t.startsWith('/uploads/')) return true;
  return false;
}

export function isValidTextSubmission(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 20000;
}

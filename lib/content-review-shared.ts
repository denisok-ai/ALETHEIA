/**
 * Константы и чистые функции, которыми пользуются и сервер, и клиентская лента согласования.
 *
 * Здесь нет node-модулей (crypto, fs): клиентский компонент ReviewBoard импортирует этот файл
 * напрямую. lib/content-review.ts реэкспортирует всё отсюда для серверного кода и тестов.
 */

export const REVIEW_LIMITS = {
  title: 300,
  body: 6000,
  speech: 3000,
  comment: 2000,
} as const;

// ---------------------------------------------------------------- готовые ответы

/**
 * Готовые фразы для комментария — одним касанием на телефоне.
 * Три группы: фразы про ролики, фразы про тексты и общие для всех.
 * Фраза попадает в комментарий отдельной строкой; повторное касание её убирает.
 */
export const REVIEW_QUICK_REPLIES = {
  video: [
    'Видео подходит, текст переписать',
    'Видео не подходит',
    'Текст не подходит к видео',
    'Ролик обрывается или слишком короткий',
  ],
  text: ['Текст слабый, нужен сильнее', 'Слишком длинно', 'Непонятно читателю'],
  common: [
    'Нравится, можно публиковать',
    'Не мой стиль — переписать моими словами',
    'Непонятно, что такое «Первый тест»',
    'Обсудим голосом',
  ],
} as const;

/** Фразы для карточки: сначала свой тип (ролик или текст), потом общие. */
export function quickRepliesFor(kind: string): string[] {
  const own: readonly string[] = (kind || '').startsWith('video')
    ? REVIEW_QUICK_REPLIES.video
    : REVIEW_QUICK_REPLIES.text;
  return [...own, ...REVIEW_QUICK_REPLIES.common];
}

/** Фраза уже есть в комментарии отдельной строкой (сравнение по trim каждой строки). */
export function hasQuickReply(comment: string, phrase: string): boolean {
  const p = phrase.trim();
  if (p === '') return false;
  return comment.split('\n').some((line) => line.trim() === p);
}

/** Убирает пустые строки в начале и в конце. Строки внутри и их содержимое не трогает. */
function trimBlankEdges(lines: string[]): string[] {
  let from = 0;
  let to = lines.length;
  while (from < to && lines[from].trim() === '') from++;
  while (to > from && lines[to - 1].trim() === '') to--;
  return lines.slice(from, to);
}

/**
 * Касание чипа. Если фраза уже есть отдельной строкой, убирает такие строки.
 * Иначе добавляет фразу новой строкой в конец. Остальной текст пользователя не меняется.
 * Если добавление не поместится в REVIEW_LIMITS.comment, возвращает комментарий без изменений.
 */
export function toggleQuickReply(comment: string, phrase: string): string {
  const p = phrase.trim();
  if (p === '') return comment;
  const lines = comment.split('\n');
  if (hasQuickReply(comment, p)) {
    return trimBlankEdges(lines.filter((line) => line.trim() !== p)).join('\n');
  }
  const base = trimBlankEdges(lines).join('\n');
  const next = base === '' ? p : `${base}\n${p}`;
  return next.length <= REVIEW_LIMITS.comment ? next : comment;
}

/**
 * Даты статьи блога: публикация и последняя правка.
 *
 * Правка — самая свежая из двух дат:
 *  - KB_REVISED (lib/content/kb-revisions.ts): ручная дата переработки текста
 *    статьи базы знаний;
 *  - BlogPost.updatedAt: статьи, которые живут только в БД. Поле меняется и от
 *    служебных правок (обложка, `--refresh` скрипта публикации), поэтому строку
 *    «Обновлено» на странице показываем только при разнице больше суток.
 *
 * Время сборки и текущее время сюда не подставляем: иначе каждый деплой
 * выглядел бы как правка всех статей.
 */

/** Разница с публикацией, начиная с которой показываем «Обновлено» (строго больше). */
export const UPDATED_NOTICE_MIN_GAP_MS = 24 * 60 * 60 * 1000;

/** Полдень по Москве: дата из KB_REVISED без времени не съезжает на соседний день. */
const REVISED_TIME_SUFFIX = 'T12:00:00+03:00';

export type ArticleDatesInput = {
  /** Дата публикации (ISO) */
  publishedAt: string | Date;
  /** BlogPost.updatedAt (ISO). У статей из файла кода его нет. */
  updatedAt?: string | Date | null;
  /** Дата переработки из KB_REVISED, YYYY-MM-DD */
  kbRevised?: string | null;
};

export type ArticleDates = {
  /** Дата публикации, ISO */
  published: string;
  /** Дата последней правки для dateModified и modifiedTime, ISO. Не раньше публикации. */
  modified: string;
  /** Показывать ли строку «Обновлено» на странице статьи */
  showUpdated: boolean;
};

/** Миллисекунды или null, если значение пусто или не читается как дата. */
function timeOf(value: string | Date | null | undefined): number | null {
  if (value == null || value === '') return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function articleDates({ publishedAt, updatedAt, kbRevised }: ArticleDatesInput): ArticleDates {
  const published = new Date(publishedAt).getTime();
  const revised = kbRevised ? timeOf(`${kbRevised}${REVISED_TIME_SUFFIX}`) : null;
  const updated = timeOf(updatedAt);
  // Правка не может быть раньше публикации: старая ревизия не откатывает дату назад.
  const modified = Math.max(published, revised ?? published, updated ?? published);
  return {
    published: new Date(published).toISOString(),
    modified: new Date(modified).toISOString(),
    showUpdated: modified - published > UPDATED_NOTICE_MIN_GAP_MS,
  };
}

/** Дата для показа на странице, например «18 октября 2026 г.». */
export function formatArticleDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Даты существенной переработки статей блога.
 *
 * `BlogPost.updatedAt` для lastmod/dateModified не годится: он меняется и от
 * технических правок (обложка, пересохранение в админке) — поисковик видел бы
 * «обновление» без нового текста. Сюда дата вносится вручную, когда текст
 * статьи действительно расширен (см. `--refresh` в blog-publish-kb-articles).
 */
export const KB_REVISED: Record<string, string> = {
  'myshechnoe-testirovanie-dlya-psihologov': '2026-09-25',
};

/** Дата последнего изменения статьи для dateModified/lastmod (ISO). */
export function blogModifiedAt(slug: string, publishedAt: string | Date): string {
  const published = new Date(publishedAt);
  const revised = KB_REVISED[slug] ? new Date(`${KB_REVISED[slug]}T12:00:00+03:00`) : null;
  return (revised && revised > published ? revised : published).toISOString();
}

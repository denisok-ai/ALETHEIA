/**
 * Описание и plain text для SEO публикаций (новости / анонсы).
 */
import { convert } from 'html-to-text';

const MAX_META_DESC = 160;

export function publicationMetaDescription(
  teaser: string | null | undefined,
  contentHtml: string
): string {
  const t = teaser?.trim();
  if (t) {
    return t.length <= MAX_META_DESC ? t : `${t.slice(0, MAX_META_DESC - 1)}…`;
  }
  const plain = convert(contentHtml || '', { wordwrap: false })
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'Публикация школы АВАТЕРРА.';
  return plain.length <= MAX_META_DESC ? plain : `${plain.slice(0, MAX_META_DESC - 1)}…`;
}

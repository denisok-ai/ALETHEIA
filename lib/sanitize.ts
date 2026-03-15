/**
 * HTML sanitization for user- or admin-authored content (e.g. publication body).
 * Prevents XSS when rendering with dangerouslySetInnerHTML.
 */
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'span', 'div',
];
const ALLOWED_ATTR = {
  a: ['href', 'title', 'target', 'rel'],
  span: ['class'],
  div: ['class'],
  p: ['class'],
  h1: ['class'], h2: ['class'], h3: ['class'], h4: ['class'],
  blockquote: ['class'],
  pre: ['class'],
  code: ['class'],
};

export function sanitizePublicationContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

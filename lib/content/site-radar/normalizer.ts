/**
 * Нормализация HTML страниц для Site Radar (извлечение блоков).
 */
import { createHash } from 'crypto';
import { convert } from 'html-to-text';

export type ContentBlock = {
  blockType: string;
  blockKey: string;
  text: string;
  hash: string;
};

const NOISE_RE =
  /cookie|consent|banner|navbar|menu|footer|header|sidebar|social|popup|modal|toast|newsletter|promo|countdown/i;

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeHtml(html: string, pageUrl: string): ContentBlock[] {
  const convertOpts: Record<string, unknown> = {
    selectors: [
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'nav', format: 'skip' },
      { selector: 'footer', format: 'skip' },
      { selector: 'header', format: 'skip' },
    ],
    wordwrap: false,
  };
  const plain = convert(html, convertOpts as Parameters<typeof convert>[1]);

  const blocks: ContentBlock[] = [];
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const text = cleanText(titleMatch[1]);
    blocks.push({ blockType: 'meta_title', blockKey: 'meta:title', text, hash: hashText(text) });
  }
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch?.[1]) {
    const text = cleanText(descMatch[1]);
    blocks.push({ blockType: 'meta_description', blockKey: 'meta:description', text, hash: hashText(text) });
  }

  const sections = plain.split(/\n{2,}/).map(cleanText).filter((s) => s.length > 40);
  let idx = 0;
  for (const section of sections) {
    if (NOISE_RE.test(section)) continue;
    const lower = section.toLowerCase();
    let blockType = 'paragraph';
    if (/₽|руб/.test(section)) blockType = 'price';
    else if (/запис|купить|оплат|подробнее|заявк/.test(lower)) blockType = 'cta';
    else if (/^#{1,3}\s/.test(section) || section.length < 120) blockType = 'heading';
    const key = `${blockType}:${idx}`;
    blocks.push({ blockType, blockKey: key, text: section, hash: hashText(section) });
    idx += 1;
  }

  if (!blocks.length && plain.trim()) {
    const text = cleanText(plain).slice(0, 8000);
    blocks.push({ blockType: 'body', blockKey: 'body:0', text, hash: hashText(text) });
  }

  void pageUrl;
  return blocks;
}

export function pageContentHash(blocks: ContentBlock[]): string {
  return hashText(blocks.map((b) => b.hash).join('|'));
}

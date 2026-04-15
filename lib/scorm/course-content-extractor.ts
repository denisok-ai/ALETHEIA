/**
 * Extract plain text from SCORM HTML files for LLM context.
 * Uses html-to-text to preserve structure (headings, lists).
 */
import { convert } from 'html-to-text';

const MAX_TOTAL_CHARS = 50_000;

export type ExtractedLesson = {
  lessonId: string;
  title: string;
  content: string;
};

const textOptions = {
  wordwrap: 200,
};

/**
 * Converts HTML string to plain text, preserving structure.
 */
export function htmlToPlainText(html: string): string {
  try {
    return convert(html, textOptions).trim();
  } catch {
    return '';
  }
}

/**
 * Extract text from HTML file entries.
 * fileEntries: array of { path, content } (path is e.g. "index.html", "lesson1/page.html").
 * Returns array of { lessonId, title, content } with total content truncated to MAX_TOTAL_CHARS.
 */
export function extractCourseContent(fileEntries: { path: string; content: string }[]): ExtractedLesson[] {
  const result: ExtractedLesson[] = [];
  let totalChars = 0;

  for (const { path: filePath, content } of fileEntries) {
    if (!content || typeof content !== 'string') continue;
    const text = htmlToPlainText(content);
    if (!text) continue;

    const lessonId = filePath.replace(/\.html$/i, '').replace(/\//g, '_') || 'main';
    const firstLine = text.split('\n')[0]?.trim().slice(0, 200) || 'Урок';

    const remaining = MAX_TOTAL_CHARS - totalChars;
    const truncated = remaining <= 0 ? '' : text.length > remaining ? text.slice(0, remaining) + '…' : text;
    totalChars += truncated.length;

    result.push({
      lessonId,
      title: firstLine,
      content: truncated,
    });

    if (totalChars >= MAX_TOTAL_CHARS) break;
  }

  return result;
}

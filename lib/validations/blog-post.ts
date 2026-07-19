/**
 * Проверка данных статьи блога (админка).
 */
import { z } from 'zod';

/** Адрес статьи: латиница, цифры и дефисы — он попадает в URL и в sitemap. */
const slugSchema = z
  .string()
  .trim()
  .min(3, 'Адрес статьи слишком короткий')
  .max(120, 'Адрес статьи слишком длинный')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Адрес: только латиница, цифры и дефисы (например: telo-znaet-otvet)');

export const blogPostInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(5, 'Заголовок слишком короткий').max(200, 'Заголовок слишком длинный'),
  /** Заголовок на странице; пустой — берётся title. */
  h1: z.string().trim().max(200).optional().default(''),
  description: z
    .string()
    .trim()
    .min(20, 'Описание слишком короткое — оно показывается в поисковой выдаче')
    .max(400, 'Описание слишком длинное'),
  body: z.string().trim().min(50, 'Текст статьи слишком короткий'),
  bodyFormat: z.enum(['markdown', 'paragraphs']).default('markdown'),
  ogImage: z.string().trim().max(300).optional().default(''),
  coverImage: z.string().trim().max(300).optional().default(''),
  status: z.enum(['draft', 'published']).default('draft'),
});

export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

/**
 * Приводит тело к виду, в котором оно хранится.
 *
 * Для формата «абзацы» в базе лежит JSON-массив: страница рисует каждый абзац
 * отдельным элементом, и хранение сырым текстом потребовало бы гадать о
 * разбиении при каждом чтении.
 */
export function normalizeBlogBody(input: { body: string; bodyFormat: 'markdown' | 'paragraphs' }): {
  body: string;
  bodyFormat: string;
} {
  if (input.bodyFormat === 'paragraphs') {
    const paragraphs = input.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    return { body: JSON.stringify(paragraphs), bodyFormat: 'paragraphs' };
  }
  return { body: input.body, bodyFormat: 'markdown' };
}

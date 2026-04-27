/**
 * Zod schemas for Publications and comments.
 */
import { z } from 'zod';

export const publicationCreateSchema = z.object({
  title: z.string().max(500).optional(),
  type: z.enum(['news', 'announcement']),
  status: z.enum(['active', 'closed']).default('active'),
  publishAt: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString())),
  teaser: z.string().max(2000).optional().nullable(),
  content: z.string().min(1, 'Текст обязателен'),
  keywords: z.string().max(1000).optional().nullable(),
  allowComments: z.boolean().default(true),
  allowRating: z.boolean().default(true),
});

export const publicationUpdateSchema = publicationCreateSchema.partial();

export const publicationCommentSchema = z.object({
  content: z.string().min(1, 'Текст комментария обязателен').max(5000),
  authorName: z.string().max(200).optional().nullable(), // для гостей
});

export const publicationRateSchema = z.object({
  value: z.number().int().min(1).max(5),
});

export type PublicationCreateInput = z.infer<typeof publicationCreateSchema>;
export type PublicationUpdateInput = z.infer<typeof publicationUpdateSchema>;
export type PublicationCommentInput = z.infer<typeof publicationCommentSchema>;
export type PublicationRateInput = z.infer<typeof publicationRateSchema>;

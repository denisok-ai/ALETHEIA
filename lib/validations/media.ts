/**
 * Zod schemas for Media (admin update, create link).
 */
import { z } from 'zod';

export const mediaUpdateSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(500).optional(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  courseId: z.string().cuid().optional().nullable(),
  allowDownload: z.boolean().optional(),
});

export const mediaCreateLinkSchema = z.object({
  url: z.string().url('Некорректный URL').max(2000),
  title: z.string().min(1, 'Название обязательно').max(500),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  allowDownload: z.boolean().optional(),
});

export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
export type MediaCreateLinkInput = z.infer<typeof mediaCreateLinkSchema>;

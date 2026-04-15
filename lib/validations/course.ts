/**
 * Zod schemas for Course CRUD and API validation.
 */
import { z } from 'zod';

export const courseCreateSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(500),
  description: z.string().max(5000).optional().nullable(),
  courseFormat: z.enum(['scorm', 'live_event']).optional(),
  eventVenue: z.string().max(2000).optional().nullable(),
  eventUrl: z.string().max(2000).optional().nullable(),
  startsAt: z.string().optional().nullable(), // ISO date/datetime string
  endsAt: z.string().optional().nullable(),
  price: z.number().int().min(0).optional().nullable(),
  status: z.enum(['draft', 'published', 'cancelled', 'archived']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().max(2000).optional().nullable(),
  aiTutorEnabled: z.boolean().optional(),
  verificationRequiredLessonIds: z
    .array(
      z.union([
        z.string(),
        z.object({
          lessonId: z.string(),
          instructions: z.string().optional(),
          maxFiles: z.number().int().min(1).max(10).optional(),
          requiredFormat: z.enum(['video', 'photo', 'document']).optional(),
        }),
      ])
    )
    .optional()
    .nullable(),
});

export const courseUpdateSchema = courseCreateSchema.partial();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

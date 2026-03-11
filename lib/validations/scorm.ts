/**
 * Zod schemas for SCORM progress API validation.
 */
import { z } from 'zod';

export const scormProgressGetQuerySchema = z.object({
  courseId: z.string().cuid(),
  lessonId: z.string().min(1),
});

export const scormProgressPostSchema = z.object({
  courseId: z.string().cuid(),
  lessonId: z.string().min(1),
  cmi_data: z.record(z.string(), z.unknown()).optional(),
  completion_status: z.string().optional().nullable(),
  score: z.number().optional().nullable(),
  time_spent: z.number().int().min(0).optional(),
});

export type ScormProgressGetQuery = z.infer<typeof scormProgressGetQuerySchema>;
export type ScormProgressPostInput = z.infer<typeof scormProgressPostSchema>;

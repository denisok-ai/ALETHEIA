/**
 * Validation schemas for enrollment (admin: add/remove user from course).
 */
import { z } from 'zod';

const MAX_BULK = 500;

export const enrollmentCreateSchema = z.object({
  userId: z.string().min(1, 'userId обязателен'),
  courseId: z.string().min(1, 'courseId обязателен'),
});

export const enrollmentBulkCreateSchema = z.object({
  courseId: z.string().min(1, 'courseId обязателен'),
  userIds: z.array(z.string().min(1)).max(MAX_BULK).optional(),
  emails: z.array(z.string().email().or(z.string().min(1))).max(MAX_BULK).optional(),
}).refine((d) => (d.userIds?.length ?? 0) > 0 || (d.emails?.length ?? 0) > 0, {
  message: 'Укажите userIds или emails',
});

export const enrollmentBulkDeleteSchema = z.object({
  courseId: z.string().min(1, 'courseId обязателен'),
  enrollmentIds: z.array(z.string().min(1)).max(MAX_BULK).optional(),
  userIds: z.array(z.string().min(1)).max(MAX_BULK).optional(),
}).refine((d) => (d.enrollmentIds?.length ?? 0) > 0 || (d.userIds?.length ?? 0) > 0, {
  message: 'Укажите enrollmentIds или userIds',
});

export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>;
export type EnrollmentBulkCreateInput = z.infer<typeof enrollmentBulkCreateSchema>;
export type EnrollmentBulkDeleteInput = z.infer<typeof enrollmentBulkDeleteSchema>;

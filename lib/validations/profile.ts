/**
 * Zod schemas for Profile (user role/status) API validation.
 */
import { z } from 'zod';

export const profileUpdateSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']).optional(),
  status: z.enum(['active', 'archived']).optional(),
  displayName: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const resetPasswordSchema = z.object({
  userId: z.string().cuid(),
  newPassword: z.string().min(8, 'Пароль не менее 8 символов'),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

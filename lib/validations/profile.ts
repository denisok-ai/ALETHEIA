/**
 * Zod schemas for Profile (admin update, student patch).
 */
import { z } from 'zod';

/** Student profile patch (displayName only). */
export const profilePatchSchema = z.object({
  displayName: z.union([z.string().max(200, 'Имя не более 200 символов'), z.literal(''), z.null()]).optional(),
});

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

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

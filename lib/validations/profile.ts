/**
 * Zod schemas for Profile (admin update, student patch).
 */
import { z } from 'zod';

/** Telegram user ID (число > 0) или очистка поля. */
export const telegramIdInputSchema = z
  .union([
    z.number().int('Telegram ID — целое число').positive('Telegram ID должен быть положительным'),
    z
      .string()
      .trim()
      .regex(/^\d+$/, 'Telegram ID — только цифры')
      .transform((v) => parseInt(v, 10)),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .nullable();

export function normalizeTelegramIdInput(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  const parsed = telegramIdInputSchema.safeParse(value);
  if (!parsed.success) return undefined;
  if (parsed.data === '' || parsed.data === null) return null;
  return parsed.data;
}

/** Student profile patch (displayName only). */
export const profilePatchSchema = z.object({
  displayName: z.union([z.string().max(200, 'Имя не более 200 символов'), z.literal(''), z.null()]).optional(),
  telegramId: telegramIdInputSchema,
});

export const profileUpdateSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']).optional(),
  status: z.enum(['active', 'archived']).optional(),
  displayName: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  telegramId: telegramIdInputSchema,
});

export const resetPasswordSchema = z.object({
  userId: z.string().cuid(),
  newPassword: z.string().min(8, 'Пароль не менее 8 символов'),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

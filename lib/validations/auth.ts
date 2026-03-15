/**
 * Shared Zod schemas for auth forms (login, register, set-password).
 * Use on both client and server.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
  password: z.string().min(1, 'Пароль обязателен'),
});

export const registerSchema = z.object({
  email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
  password: z.string().min(8, 'Пароль не менее 8 символов').refine((p) => /\d/.test(p), 'Пароль должен содержать хотя бы одну цифру').refine((p) => /[a-zA-Zа-яА-ЯёЁ]/.test(p), 'Пароль должен содержать хотя бы одну букву'),
  displayName: z.string().max(200).optional().nullable(),
});

export const setPasswordSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
  password: z.string().min(8, 'Пароль не менее 8 символов').refine((p) => /\d/.test(p), 'Пароль должен содержать хотя бы одну цифру').refine((p) => /[a-zA-Zа-яА-ЯёЁ]/.test(p), 'Пароль должен содержать хотя бы одну букву'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email обязателен').email('Некорректный email'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

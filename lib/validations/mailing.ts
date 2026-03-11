/**
 * Zod schemas for Mailings.
 */
import { z } from 'zod';

const recipientConfigSchema = z.object({
  type: z.enum(['all', 'role', 'list', 'groups']),
  role: z.string().optional(),
  userIds: z.array(z.string().cuid()).optional(),
  /** Include users that belong to any of these groups (moduleType=user). */
  groupIds: z.array(z.string().cuid()).optional(),
  /** Exclude users that belong to any of these groups (applied after include). */
  excludeGroupIds: z.array(z.string().cuid()).optional(),
});

export const mailingCreateSchema = z.object({
  internalTitle: z.string().min(1, 'Название обязательно').max(300),
  emailSubject: z.string().min(1, 'Тема обязательна').max(500),
  emailBody: z.string().min(1, 'Текст обязателен'),
  senderName: z.string().max(200).optional().nullable(),
  senderEmail: z.string().email().optional().nullable().or(z.literal('')),
  scheduleMode: z.enum(['manual', 'scheduled']).default('manual'),
  scheduledAt: z.union([z.string(), z.date()]).optional().nullable().transform((v) => (v == null ? null : new Date(v).toISOString())),
  recipientConfig: recipientConfigSchema.optional().nullable(),
  attachments: z.string().optional().nullable(), // JSON
});

export const mailingUpdateSchema = z.object({
  internalTitle: z.string().min(1).max(300).optional(),
  emailSubject: z.string().min(1).max(500).optional(),
  emailBody: z.string().min(1).optional(),
  senderName: z.string().max(200).optional().nullable(),
  senderEmail: z.string().email().optional().nullable().or(z.literal('')),
  scheduleMode: z.enum(['manual', 'scheduled']).optional(),
  scheduledAt: z.union([z.string(), z.date()]).optional().nullable().transform((v) => (v == null ? null : new Date(v).toISOString())),
  recipientConfig: recipientConfigSchema.optional().nullable(),
  attachments: z.string().optional().nullable(),
});

export type MailingCreateInput = z.infer<typeof mailingCreateSchema>;
export type MailingUpdateInput = z.infer<typeof mailingUpdateSchema>;
export type RecipientConfig = z.infer<typeof recipientConfigSchema>;

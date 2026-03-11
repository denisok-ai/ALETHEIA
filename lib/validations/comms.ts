/**
 * Zod schemas for Communications (templates, send).
 */
import { z } from 'zod';

export const commsTemplateCreateSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(200),
  channel: z.enum(['email', 'telegram']),
  subject: z.string().max(500).optional().nullable(),
  htmlBody: z.string().max(100_000).optional().nullable(),
  variables: z.string().optional().nullable(), // JSON array of variable names
});

export const commsTemplateUpdateSchema = commsTemplateCreateSchema.partial();

export const commsSendSchema = z.object({
  templateId: z.string().cuid(),
  recipientType: z.enum(['all', 'role', 'list', 'groups']),
  role: z.string().optional(), // for recipientType=role: user, manager, admin
  recipientIds: z.array(z.string()).optional(), // user ids for list
  /** Include users from these groups (for recipientType=groups). */
  groupIds: z.array(z.string().cuid()).optional(),
  /** Exclude users that belong to any of these groups (applied after include). */
  excludeGroupIds: z.array(z.string().cuid()).optional(),
});

export type CommsTemplateCreateInput = z.infer<typeof commsTemplateCreateSchema>;
export type CommsTemplateUpdateInput = z.infer<typeof commsTemplateUpdateSchema>;
export type CommsSendInput = z.infer<typeof commsSendSchema>;

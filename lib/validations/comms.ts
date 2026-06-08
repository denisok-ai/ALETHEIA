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

export const commsSendSchema = z
  .object({
    templateId: z.string().cuid().optional(),
    channel: z.enum(['email', 'telegram']).optional(),
    subject: z.string().max(500).optional().nullable(),
    htmlBody: z.string().max(100_000).optional().nullable(),
    recipientType: z.enum(['all', 'role', 'list', 'groups']),
    role: z.string().optional(),
    recipientIds: z.array(z.string()).optional(),
    groupIds: z.array(z.string().cuid()).optional(),
    excludeGroupIds: z.array(z.string().cuid()).optional(),
    attachmentPaths: z.array(z.string().max(400)).max(5).optional(),
  })
  .superRefine((data, ctx) => {
    const hasTpl = Boolean(data.templateId?.trim());
    if (!hasTpl) {
      if (!data.channel) {
        ctx.addIssue({ code: 'custom', message: 'Укажите канал или выберите шаблон', path: ['channel'] });
      }
      if (!data.htmlBody?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Укажите текст/HTML или выберите шаблон', path: ['htmlBody'] });
      }
      if (data.channel === 'email' && !data.subject?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Для email укажите тему', path: ['subject'] });
      }
    }
  });

export const commsSendTestSchema = z.object({
  templateId: z.string().cuid(),
  testEmail: z.string().email('Некорректный email'),
});

export type CommsTemplateCreateInput = z.infer<typeof commsTemplateCreateSchema>;
export type CommsTemplateUpdateInput = z.infer<typeof commsTemplateUpdateSchema>;
export type CommsSendPayload = z.infer<typeof commsSendSchema>;
/** @deprecated используйте CommsSendPayload */
export type CommsSendInput = CommsSendPayload;

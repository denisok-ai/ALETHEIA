/**
 * Zod schemas for Lead (CRM) API validation.
 */
import { z } from 'zod';

export const leadUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted']).optional(),
  notes: z.string().max(10000).optional().nullable(),
});

export const leadConvertSchema = z.object({
  leadId: z.number().int().positive(),
  email: z.string().email(),
  password: z.string().min(8, 'Пароль не менее 8 символов'),
  displayName: z.string().max(200).optional(),
  courseId: z.string().cuid().optional(),
});

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
export type LeadConvertInput = z.infer<typeof leadConvertSchema>;

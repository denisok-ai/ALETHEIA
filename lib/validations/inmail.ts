import { z } from 'zod';

export const inboundMailboxCreateSchema = z.object({
  label: z.string().min(1).max(120),
  imapHost: z.string().min(1).max(255),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  imapTls: z.boolean().default(true),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(500),
  folder: z.string().min(1).max(255).default('INBOX'),
  enabled: z.boolean().default(true),
  smtpHost: z.string().max(255).optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpTls: z.boolean().optional().nullable(),
});

export const inboundMailboxPatchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  imapHost: z.string().min(1).max(255).optional(),
  imapPort: z.coerce.number().int().min(1).max(65535).optional(),
  imapTls: z.boolean().optional(),
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(1).max(500).optional(),
  folder: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  smtpHost: z.string().max(255).optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpTls: z.boolean().optional().nullable(),
});

export const inmailReplySchema = z.object({
  text: z.string().min(1).max(100_000),
  html: z.string().max(500_000).optional(),
});

/**
 * Shared Zod schemas for support tickets.
 */
import { z } from 'zod';

export const ticketCreateSchema = z.object({
  subject: z.string().trim().min(1, 'Укажите тему обращения').max(500, 'Тема не более 500 символов'),
  message: z.string().max(10000).optional(),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;

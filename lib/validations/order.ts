/**
 * Zod schemas for Order (payments) API validation.
 */
import { z } from 'zod';

export const orderConfirmSchema = z.object({
  orderId: z.number().int().positive(),
});

export const orderExportQuerySchema = z.object({
  status: z.enum(['pending', 'paid']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type OrderConfirmInput = z.infer<typeof orderConfirmSchema>;
export type OrderExportQuery = z.infer<typeof orderExportQuerySchema>;

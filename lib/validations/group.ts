/**
 * Zod schemas for hierarchical Groups (Courses, Media, Users modules).
 */
import { z } from 'zod';

export const moduleTypeEnum = z.enum(['course', 'media', 'user']);
export const groupTypeEnum = z.enum(['static', 'dynamic']);
export const accessTypeEnum = z.enum(['common', 'personal']);
export const showSubgroupsModeEnum = z.enum(['list', 'icons']);
export const userGroupRoleEnum = z.enum(['member', 'moderator']);

export const groupCreateSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(500),
  description: z.string().max(2000).optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  moduleType: moduleTypeEnum,
  type: groupTypeEnum.default('static'),
  accessType: accessTypeEnum.default('common'),
  displayOrder: z.number().int().min(0).optional(),
  smallIcon: z.string().max(500).optional().nullable(),
  largeIcon: z.string().max(500).optional().nullable(),
  showSubgroupsMode: showSubgroupsModeEnum.optional().nullable(),
});

export const groupUpdateSchema = groupCreateSchema.partial();

export const groupDeleteSchema = z.object({
  deleteNestedItems: z.boolean().optional(), // true = удалить вложенные элементы связи; false = только отвязать
});

export const assignCourseSchema = z.object({ courseId: z.string().cuid() });
export const assignMediaSchema = z.object({ mediaId: z.string().cuid(), sortOrder: z.number().int().min(0).optional() });
export const assignUserSchema = z.object({
  userId: z.string().cuid(),
  role: userGroupRoleEnum.default('member'),
});

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
export type ModuleType = z.infer<typeof moduleTypeEnum>;

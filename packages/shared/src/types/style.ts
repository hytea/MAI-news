import { z } from 'zod';

export enum PredefinedStyle {
  CONVERSATIONAL = 'conversational',
  ACADEMIC = 'academic',
  BULLET_POINT = 'bullet_point',
  ELI5 = 'eli5',
  EXECUTIVE = 'executive',
  TECHNICAL = 'technical',
  CASUAL = 'casual',
}

export const StyleProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  predefinedStyle: z.nativeEnum(PredefinedStyle).optional(),
  customPrompt: z.string().optional(),
  tone: z.enum(['formal', 'casual', 'neutral']).default('neutral'),
  length: z.enum(['concise', 'medium', 'detailed']).default('medium'),
  technicalLevel: z.number().min(1).max(10).default(5),
  includeContext: z.boolean().default(true),
  includeKeyPoints: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  usageCount: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;

export const CreateStyleProfileSchema = StyleProfileSchema.omit({
  id: true,
  userId: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateStyleProfile = z.infer<typeof CreateStyleProfileSchema>;

export const UpdateStyleProfileSchema = CreateStyleProfileSchema.partial();

export type UpdateStyleProfile = z.infer<typeof UpdateStyleProfileSchema>;

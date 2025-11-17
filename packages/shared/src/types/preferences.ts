import { z } from 'zod';
import { ArticleCategory } from './article';

export const UserPreferencesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  followedCategories: z.array(z.nativeEnum(ArticleCategory)).default([]),
  mutedCategories: z.array(z.nativeEnum(ArticleCategory)).default([]),
  followedSources: z.array(z.string().uuid()).default([]),
  mutedSources: z.array(z.string().uuid()).default([]),
  defaultStyleProfileId: z.string().uuid().optional(),
  notificationsEnabled: z.boolean().default(true),
  emailDigestEnabled: z.boolean().default(false),
  emailDigestTime: z.string().optional(), // HH:MM format
  breakingNewsAlerts: z.boolean().default(false),
  preferredReadingTime: z.enum(['morning', 'afternoon', 'evening']).default('morning'),
  articlesPerSession: z.number().min(1).max(50).default(10),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UpdateUserPreferencesSchema = UserPreferencesSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type UpdateUserPreferences = z.infer<typeof UpdateUserPreferencesSchema>;

import { z } from 'zod';

export const ReadingHistorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  articleId: z.string().uuid(),
  rewrittenArticleId: z.string().uuid().optional(),
  readingTimeSeconds: z.number().optional(),
  completed: z.boolean().default(false),
  createdAt: z.date(),
});

export type ReadingHistory = z.infer<typeof ReadingHistorySchema>;

export const CreateReadingHistorySchema = ReadingHistorySchema.omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type CreateReadingHistory = z.infer<typeof CreateReadingHistorySchema>;

export const SavedArticleSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  articleId: z.string().uuid(),
  notes: z.string().optional(),
  createdAt: z.date(),
});

export type SavedArticle = z.infer<typeof SavedArticleSchema>;

export const CreateSavedArticleSchema = SavedArticleSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type CreateSavedArticle = z.infer<typeof CreateSavedArticleSchema>;

import { z } from 'zod';

export enum ArticleCategory {
  POLITICS = 'politics',
  TECHNOLOGY = 'technology',
  BUSINESS = 'business',
  SCIENCE = 'science',
  HEALTH = 'health',
  ENTERTAINMENT = 'entertainment',
  SPORTS = 'sports',
  WORLD = 'world',
  OTHER = 'other',
}

export const SourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  reliabilityScore: z.number().min(0).max(100).optional(),
  favicon: z.string().url().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Source = z.infer<typeof SourceSchema>;

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  title: z.string(),
  originalContent: z.string(),
  url: z.string().url(),
  author: z.string().optional(),
  publishedAt: z.date(),
  category: z.nativeEnum(ArticleCategory),
  imageUrl: z.string().url().optional(),
  importanceScore: z.number().min(0).max(100).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Article = z.infer<typeof ArticleSchema>;

export const CitationSchema = z.object({
  id: z.string().uuid(),
  rewrittenArticleId: z.string().uuid(),
  sourceArticleId: z.string().uuid().optional(),
  text: z.string(),
  url: z.string().url().optional(),
  position: z.number(),
  createdAt: z.date(),
});

export type Citation = z.infer<typeof CitationSchema>;

export const RewrittenArticleSchema = z.object({
  id: z.string().uuid(),
  articleId: z.string().uuid(),
  userId: z.string().uuid(),
  styleProfileId: z.string().uuid(),
  rewrittenContent: z.string(),
  summary: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  processingTimeMs: z.number().optional(),
  aiCost: z.number().optional(),
  createdAt: z.date(),
});

export type RewrittenArticle = z.infer<typeof RewrittenArticleSchema>;

export const ArticleWithSourceSchema = ArticleSchema.extend({
  source: SourceSchema,
});

export type ArticleWithSource = z.infer<typeof ArticleWithSourceSchema>;

export const RewrittenArticleWithDetailsSchema = RewrittenArticleSchema.extend({
  article: ArticleWithSourceSchema,
  citations: z.array(CitationSchema),
});

export type RewrittenArticleWithDetails = z.infer<typeof RewrittenArticleWithDetailsSchema>;

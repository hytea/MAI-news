import { z } from 'zod';
import { StyleProfile } from './style';

export interface AIProvider {
  name: string;
  rewriteArticle(content: string, style: StyleProfile): Promise<AIRewriteResult>;
  generateSummary(content: string, maxLength: number): Promise<string>;
  extractKeyPoints(content: string, count: number): Promise<string[]>;
  detectBias(content: string): Promise<BiasAnalysis>;
  enrichWithContext(content: string, topic: string): Promise<string>;
  estimateCost(operation: AIOperation, inputTokens: number, outputTokens?: number): number;
}

export enum AIOperation {
  REWRITE = 'rewrite',
  SUMMARY = 'summary',
  KEY_POINTS = 'key_points',
  BIAS_DETECTION = 'bias_detection',
  CONTEXT_ENRICHMENT = 'context_enrichment',
}

export const AIRewriteResultSchema = z.object({
  content: z.string(),
  summary: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  citations: z.array(z.object({
    text: z.string(),
    url: z.string().url().optional(),
    position: z.number(),
  })).optional(),
  processingTimeMs: z.number(),
  tokensUsed: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number(),
  }),
  cost: z.number(),
});

export type AIRewriteResult = z.infer<typeof AIRewriteResultSchema>;

export const BiasAnalysisSchema = z.object({
  overallBias: z.enum(['left', 'center-left', 'center', 'center-right', 'right', 'unknown']),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  alternativePerspectives: z.array(z.string()).optional(),
});

export type BiasAnalysis = z.infer<typeof BiasAnalysisSchema>;

export const AIProviderConfigSchema = z.object({
  provider: z.enum(['openrouter', 'openai', 'anthropic']),
  apiKey: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(4000),
  timeoutMs: z.number().default(30000),
});

export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;

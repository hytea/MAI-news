// Enums matching backend
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

export enum PredefinedStyle {
  CONVERSATIONAL = 'conversational',
  ACADEMIC = 'academic',
  BULLET_POINT = 'bullet_point',
  ELI5 = 'eli5',
  EXECUTIVE = 'executive',
  TECHNICAL = 'technical',
  CASUAL = 'casual',
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  reliabilityScore?: number;
  favicon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  sourceId: string;
  title: string;
  originalContent: string;
  url: string;
  author?: string;
  publishedAt: string;
  category: ArticleCategory;
  imageUrl?: string;
  importanceScore?: number;
  createdAt: string;
  updatedAt: string;
  source?: Source;
}

export interface StyleProfile {
  id: string;
  userId: string;
  name: string;
  description?: string;
  predefinedStyle?: PredefinedStyle;
  customPrompt?: string;
  tone: 'formal' | 'casual' | 'neutral';
  length: 'concise' | 'medium' | 'detailed';
  technicalLevel: number;
  includeContext: boolean;
  includeKeyPoints: boolean;
  isDefault: boolean;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RewrittenArticle {
  id: string;
  articleId: string;
  userId: string;
  styleProfileId: string;
  rewrittenContent: string;
  summary?: string;
  keyPoints?: string[];
  processingTimeMs?: number;
  aiCost?: number;
  createdAt: string;
  article?: Article;
  citations?: Citation[];
}

export interface Citation {
  id: string;
  rewrittenArticleId: string;
  sourceArticleId?: string;
  text: string;
  url?: string;
  position: number;
  createdAt: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  followedCategories: ArticleCategory[];
  mutedCategories: ArticleCategory[];
  followedSources: string[];
  mutedSources: string[];
  defaultStyleProfileId?: string;
  notificationsEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestTime?: string;
  breakingNewsAlerts: boolean;
  preferredReadingTime: 'morning' | 'afternoon' | 'evening';
  articlesPerSession: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingHistory {
  id: string;
  userId: string;
  articleId: string;
  rewrittenArticleId?: string;
  readAt: string;
  readingTimeSeconds?: number;
  completed: boolean;
  progressPercentage?: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// AI Feature Types
export type BiasLevel = 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'unknown';
export type SeverityLevel = 'low' | 'medium' | 'high';

export interface BiasIndicator {
  type: string;
  description: string;
  severity: SeverityLevel;
}

export interface BiasAnalysis {
  overallBias: BiasLevel;
  confidence: number; // 0-1
  indicators: BiasIndicator[];
  alternativePerspectives?: string[];
}

export interface EnrichedContext {
  originalContent: string;
  enrichedContent: string;
  topic: string;
}

export interface KeyPointsData {
  keyPoints: string[];
  count: number;
}

import { formatDistanceToNow, format } from 'date-fns';
import { ArticleCategory } from '../types';

export const formatTimeAgo = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'MMM d, yyyy');
};

export const formatReadingTime = (minutes: number): string => {
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
};

export const calculateReadingTime = (content: string): number => {
  // Average reading speed: 200-250 words per minute
  const wordsPerMinute = 225;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const formatCategoryLabel = (category: ArticleCategory): string => {
  const labels: Record<ArticleCategory, string> = {
    [ArticleCategory.POLITICS]: 'Politics',
    [ArticleCategory.TECHNOLOGY]: 'Technology',
    [ArticleCategory.BUSINESS]: 'Business',
    [ArticleCategory.SCIENCE]: 'Science',
    [ArticleCategory.HEALTH]: 'Health',
    [ArticleCategory.ENTERTAINMENT]: 'Entertainment',
    [ArticleCategory.SPORTS]: 'Sports',
    [ArticleCategory.WORLD]: 'World',
    [ArticleCategory.OTHER]: 'Other',
  };
  return labels[category] || category;
};

import { formatDistanceToNow, format } from 'date-fns';

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

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const getStyleLabel = (style: string): string => {
  const labels: Record<string, string> = {
    conversational: 'Conversational',
    academic: 'Academic',
    'bullet-point': 'Bullet Points',
    eli5: 'ELI5',
    executive: 'Executive Brief',
    original: 'Original',
  };
  return labels[style] || style;
};

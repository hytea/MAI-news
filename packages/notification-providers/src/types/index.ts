/**
 * Notification types supported by the system
 */
export enum NotificationType {
  BREAKING_NEWS = 'breaking_news',
  DAILY_DIGEST = 'daily_digest',
  ARTICLE_RECOMMENDATION = 'article_recommendation',
  READING_STREAK = 'reading_streak',
  COMMENT_REPLY = 'comment_reply',
  SYSTEM_ALERT = 'system_alert',
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Delivery channels for notifications
 */
export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
  SMS = 'sms', // Future
}

/**
 * Notification status
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

/**
 * Base notification payload
 */
export interface NotificationPayload {
  userId: number;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, any>;
  actionUrl?: string;
  imageUrl?: string;
  expiresAt?: Date;
}

/**
 * Email-specific payload
 */
export interface EmailNotificationPayload extends NotificationPayload {
  channel: NotificationChannel.EMAIL;
  subject: string;
  htmlBody?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
}

/**
 * Push notification payload
 */
export interface PushNotificationPayload extends NotificationPayload {
  channel: NotificationChannel.PUSH;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * In-app notification payload
 */
export interface InAppNotificationPayload extends NotificationPayload {
  channel: NotificationChannel.IN_APP;
  category?: string;
}

/**
 * Union type for all notification payloads
 */
export type AnyNotificationPayload =
  | EmailNotificationPayload
  | PushNotificationPayload
  | InAppNotificationPayload;

/**
 * Notification delivery result
 */
export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  externalId?: string;
  channel: NotificationChannel;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  sender?: string;
  webhookUrl?: string;
  options?: Record<string, any>;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  breakingNewsEnabled: boolean;
  dailyDigestEnabled: boolean;
  dailyDigestTime?: string; // HH:MM format
  articleRecommendationsEnabled: boolean;
  readingStreakEnabled: boolean;
  commentRepliesEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  preferredChannels: NotificationChannel[];
}

/**
 * Batch notification request
 */
export interface BatchNotificationRequest {
  notifications: AnyNotificationPayload[];
  scheduledFor?: Date;
}

/**
 * Template data for notification templates
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject?: string;
  bodyTemplate: string;
  htmlTemplate?: string;
  variables: string[];
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { authenticateUser } from '../middleware/auth.middleware';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { InAppNotificationProvider } from '../../../notification-providers/src';
import { NotificationChannel, ProviderConfig } from '../../../notification-providers/src';

let notificationService: NotificationService;
let preferencesService: NotificationPreferencesService;
let inAppProvider: InAppNotificationProvider;

/**
 * Initialize notification routes
 */
export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  const db = app.db as Pool;

  // Initialize services
  const providerConfigs = new Map<NotificationChannel, ProviderConfig>([
    [
      NotificationChannel.EMAIL,
      {
        enabled: !!process.env.RESEND_API_KEY,
        apiKey: process.env.RESEND_API_KEY,
        sender: process.env.EMAIL_FROM || 'NewsCurator AI <noreply@newscurator.ai>',
      },
    ],
    [
      NotificationChannel.IN_APP,
      {
        enabled: true, // Always enabled
      },
    ],
    [
      NotificationChannel.PUSH,
      {
        enabled: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        options: {
          vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
          vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
          vapidSubject: process.env.VAPID_SUBJECT || 'mailto:noreply@newscurator.ai',
        },
      },
    ],
  ]);

  notificationService = new NotificationService(db, providerConfigs);
  preferencesService = new NotificationPreferencesService(db);
  inAppProvider = notificationService.getProvider(NotificationChannel.IN_APP) as InAppNotificationProvider;

  /**
   * Get user's notifications (paginated)
   */
  app.get(
    '/',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Querystring: {
        limit?: string;
        offset?: string;
        unread_only?: string;
      };
    }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const limit = parseInt(request.query.limit || '50', 10);
      const offset = parseInt(request.query.offset || '0', 10);
      const unreadOnly = request.query.unread_only === 'true';

      if (!inAppProvider) {
        return reply.status(503).send({ error: 'Notification service not available' });
      }

      const notifications = await inAppProvider.getUserNotifications(
        userId,
        limit,
        offset,
        unreadOnly
      );

      const unreadCount = await inAppProvider.getUnreadCount(userId);

      reply.send({
        notifications,
        unreadCount,
        limit,
        offset,
      });
    }
  );

  /**
   * Get unread notification count
   */
  app.get(
    '/unread-count',
    { preHandler: authenticateUser },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).user.userId;

      if (!inAppProvider) {
        return reply.status(503).send({ error: 'Notification service not available' });
      }

      const count = await inAppProvider.getUnreadCount(userId);

      reply.send({ unreadCount: count });
    }
  );

  /**
   * Mark notification as read
   */
  app.patch(
    '/:id/read',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Params: { id: string };
    }>, reply: FastifyReply) => {
      const { id } = request.params;

      if (!inAppProvider) {
        return reply.status(503).send({ error: 'Notification service not available' });
      }

      const success = await inAppProvider.markAsRead(id);

      if (!success) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      reply.send({ success: true });
    }
  );

  /**
   * Mark all notifications as read
   */
  app.post(
    '/mark-all-read',
    { preHandler: authenticateUser },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).user.userId;

      if (!inAppProvider) {
        return reply.status(503).send({ error: 'Notification service not available' });
      }

      const success = await inAppProvider.markAllAsRead(userId);

      reply.send({ success });
    }
  );

  /**
   * Delete notification
   */
  app.delete(
    '/:id',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Params: { id: string };
    }>, reply: FastifyReply) => {
      const { id } = request.params;
      const userId = (request as any).user.userId;

      if (!inAppProvider) {
        return reply.status(503).send({ error: 'Notification service not available' });
      }

      const success = await inAppProvider.deleteNotification(id, userId);

      if (!success) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      reply.send({ success: true });
    }
  );

  /**
   * Get notification preferences
   */
  app.get(
    '/preferences',
    { preHandler: authenticateUser },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).user.userId;

      let preferences = await preferencesService.getPreferences(userId);

      if (!preferences) {
        preferences = await preferencesService.createDefaultPreferences(userId);
      }

      reply.send(preferences);
    }
  );

  /**
   * Update notification preferences
   */
  app.patch(
    '/preferences',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Body: any;
    }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const preferences = await preferencesService.updatePreferences(userId, request.body);

      reply.send(preferences);
    }
  );

  /**
   * Subscribe to push notifications
   */
  app.post(
    '/push/subscribe',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Body: {
        subscription: PushSubscription;
      };
    }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { subscription } = request.body;

      const pushProvider = notificationService.getProvider(NotificationChannel.PUSH);

      if (!pushProvider || !('subscribe' in pushProvider)) {
        return reply.status(503).send({ error: 'Push notifications not available' });
      }

      const subscriptionId = await (pushProvider as any).subscribe(userId, subscription);

      if (!subscriptionId) {
        return reply.status(500).send({ error: 'Failed to save subscription' });
      }

      reply.send({ success: true, subscriptionId });
    }
  );

  /**
   * Unsubscribe from push notifications
   */
  app.post(
    '/push/unsubscribe',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Body: {
        endpoint: string;
      };
    }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { endpoint } = request.body;

      const pushProvider = notificationService.getProvider(NotificationChannel.PUSH);

      if (!pushProvider || !('unsubscribe' in pushProvider)) {
        return reply.status(503).send({ error: 'Push notifications not available' });
      }

      const success = await (pushProvider as any).unsubscribe(userId, endpoint);

      reply.send({ success });
    }
  );

  /**
   * Get VAPID public key for push subscriptions
   */
  app.get(
    '/push/vapid-public-key',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const pushProvider = notificationService.getProvider(NotificationChannel.PUSH);

      if (!pushProvider || !('getPublicKey' in pushProvider)) {
        return reply.status(503).send({ error: 'Push notifications not available' });
      }

      const publicKey = (pushProvider as any).getPublicKey();

      reply.send({ publicKey });
    }
  );

  /**
   * Test notification (for development)
   */
  app.post(
    '/test',
    { preHandler: authenticateUser },
    async (request: FastifyRequest<{
      Body: {
        type?: string;
        title?: string;
        body?: string;
      };
    }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { type, title, body } = request.body;

      const result = await notificationService.send({
        userId,
        type: (type as any) || 'system_alert',
        priority: 'medium' as any,
        title: title || 'Test Notification',
        body: body || 'This is a test notification from NewsCurator AI',
        actionUrl: '/news-feed',
      });

      reply.send({ results: result });
    }
  );

  /**
   * Health check for notification providers
   */
  app.get(
    '/health',
    { preHandler: authenticateUser },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const health = await notificationService.healthCheck();

      const healthStatus: Record<string, boolean> = {};
      health.forEach((status, channel) => {
        healthStatus[channel] = status;
      });

      reply.send(healthStatus);
    }
  );
}

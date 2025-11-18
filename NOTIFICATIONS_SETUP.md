# Notifications System Setup Guide

This guide explains how to set up and configure the comprehensive notifications system in NewsCurator AI.

## Overview

The notifications system supports multiple delivery channels:
- **Email** (via Resend API - 3,000 emails/month free)
- **In-App** (database-backed, always free)
- **Web Push** (native browser API, always free)

## Features

### Notification Types
- **Breaking News**: High-importance articles matching user interests
- **Daily Digest**: Personalized daily summary at user's preferred time
- **Article Recommendations**: Based on reading history
- **Reading Streak**: Reminders to maintain streaks (future)
- **Comment Replies**: Social engagement notifications (future)

### User Controls
- Enable/disable each notification type
- Set preferred delivery channels
- Configure daily digest time
- Set quiet hours (no notifications)
- Granular channel preferences (email, push, in-app)

## Environment Variables

Add these to your `.env` file:

```bash
# Email Notifications (Resend)
# Sign up at https://resend.com (free tier: 3,000 emails/month)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="NewsCurator AI <noreply@newscurator.ai>"

# Web Push Notifications (VAPID keys)
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:noreply@newscurator.ai
```

## Setup Instructions

### 1. Install Dependencies

```bash
# From project root
npm install

# Or install specific packages
cd packages/notification-providers
npm install
npm run build
```

### 2. Generate VAPID Keys (for Push Notifications)

```bash
npx web-push generate-vapid-keys
```

Copy the output to your `.env` file.

### 3. Get Resend API Key (for Email Notifications)

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account (3,000 emails/month)
3. Create an API key in the dashboard
4. Add to `.env` as `RESEND_API_KEY`

### 4. Run Database Migrations

```bash
cd packages/api
npm run migrate:up
```

This creates the following tables:
- `notifications` - In-app notifications
- `push_subscriptions` - Web push subscriptions
- `notification_preferences` - User notification settings
- `notification_logs` - Audit log of all sent notifications
- `notification_templates` - Email/notification templates

### 5. Start the Server

```bash
cd packages/api
npm run dev
```

The notification scheduler will automatically start and:
- Check for breaking news every 15 minutes
- Process daily digests every hour
- Send article recommendations every 6 hours
- Clean up expired notifications daily

## API Endpoints

### Get Notifications
```
GET /api/notifications?limit=50&offset=0&unread_only=false
Authorization: Bearer <token>
```

### Get Unread Count
```
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

### Mark as Read
```
PATCH /api/notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```
POST /api/notifications/mark-all-read
Authorization: Bearer <token>
```

### Delete Notification
```
DELETE /api/notifications/:id
Authorization: Bearer <token>
```

### Get Preferences
```
GET /api/notifications/preferences
Authorization: Bearer <token>
```

### Update Preferences
```
PATCH /api/notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "emailEnabled": true,
  "pushEnabled": true,
  "inAppEnabled": true,
  "breakingNewsEnabled": true,
  "dailyDigestEnabled": true,
  "dailyDigestTime": "08:00",
  "articleRecommendationsEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00",
  "preferredChannels": ["email", "in_app", "push"]
}
```

### Subscribe to Push
```
POST /api/notifications/push/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "subscription": <PushSubscription object from browser>
}
```

### Get VAPID Public Key
```
GET /api/notifications/push/vapid-public-key
```

### Test Notification
```
POST /api/notifications/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "system_alert",
  "title": "Test Notification",
  "body": "This is a test"
}
```

## Frontend Routes

- `/notifications` - Notification hub (view all notifications)
- `/settings/notifications` - Notification preferences

## Provider Architecture

The system uses a provider pattern similar to the AI providers:

```typescript
// BaseNotificationProvider
interface BaseNotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationResult>;
  sendBatch(batch: BatchNotificationRequest): Promise<NotificationResult[]>;
  healthCheck(): Promise<boolean>;
  getMetadata(): ProviderMetadata;
}

// Providers
- ResendEmailProvider (email via Resend)
- InAppNotificationProvider (database-backed)
- WebPushProvider (native Web Push API)
```

### Adding a New Provider

1. Create a new provider class extending `BaseNotificationProvider`
2. Implement required methods: `send()`, `healthCheck()`, `getMetadata()`
3. Add to `NotificationProviderFactory`
4. Update environment variables and config

Example:
```typescript
import { BaseNotificationProvider } from './base/BaseNotificationProvider';

export class TwilioSMSProvider extends BaseNotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // Implementation
  }

  async healthCheck(): Promise<boolean> {
    // Implementation
  }

  getMetadata() {
    return {
      name: 'Twilio SMS',
      channel: NotificationChannel.SMS,
      description: 'SMS via Twilio',
    };
  }
}
```

## Notification Triggers

### Breaking News
- Runs every 15 minutes
- Finds articles with `importance_score >= 8` from last hour
- Sends to users who follow the article's category
- Only sends if user hasn't been notified about this article

### Daily Digest
- Runs every hour
- Checks for users with matching digest time
- Includes top 10 articles from last 24 hours
- Filtered by user's category preferences

### Article Recommendations
- Runs every 6 hours
- Based on user's reading history (last 7 days)
- Suggests articles they haven't read yet
- Won't recommend same article twice in 7 days

## Customizing Notification Templates

Email templates are stored in the `notification_templates` table:

```sql
UPDATE notification_templates
SET subject_template = 'Breaking: {{title}}',
    body_template = 'Hi {{userName}}, check this out: {{articleTitle}}',
    html_template = '<h1>{{articleTitle}}</h1><p>{{summary}}</p>'
WHERE type = 'breaking_news';
```

## Testing

### Test In-App Notifications
```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Testing notifications"}'
```

### Test Email (requires RESEND_API_KEY)
Set user preferences to include email, then trigger a notification.

### Test Push (requires VAPID keys and subscription)
1. Enable push in frontend
2. Allow browser notifications
3. Subscribe via /push/subscribe
4. Trigger a breaking news notification

## Monitoring

### Health Check
```
GET /api/notifications/health
Authorization: Bearer <token>
```

Returns status of all providers:
```json
{
  "email": true,
  "in_app": true,
  "push": true
}
```

### Notification Logs
All sent notifications are logged in `notification_logs` table:
```sql
SELECT * FROM notification_logs
WHERE user_id = 123
ORDER BY sent_at DESC
LIMIT 50;
```

## Troubleshooting

### Email not sending
1. Verify `RESEND_API_KEY` is set correctly
2. Check Resend dashboard for errors
3. Ensure email preferences are enabled
4. Check `notification_logs` for error messages

### Push notifications not working
1. Verify VAPID keys are generated and set
2. Check browser supports push (Chrome, Firefox, Edge)
3. Ensure user granted notification permission
4. Verify subscription exists in `push_subscriptions` table

### Notifications not appearing in app
1. Check `notifications` table has records
2. Verify user preferences allow in-app notifications
3. Check frontend is polling for updates
4. Clear browser cache and reload

### Scheduler not running
1. Check server logs for scheduler startup message
2. Verify database connection
3. Check for errors in notification worker

## Cost Optimization

### Free Tier Limits
- **Resend**: 3,000 emails/month (100/day)
- **In-App**: Unlimited (database storage only)
- **Push**: Unlimited (native browser API)

### Tips to Stay Within Free Tier
1. Use in-app + push for frequent notifications
2. Reserve email for important notifications only
3. Set appropriate quiet hours to reduce sends
4. Batch daily digest instead of individual emails
5. Use `preferredChannels` to control delivery

## Security Considerations

1. **VAPID Keys**: Keep private key secret, never expose to frontend
2. **API Keys**: Store securely in environment variables
3. **Rate Limiting**: API endpoints are rate-limited
4. **Authentication**: All endpoints require valid JWT
5. **User Isolation**: Users can only access their own notifications

## Performance

- In-app notifications: Instant (database write)
- Email: 1-3 seconds per send
- Push: < 1 second per device
- Batch operations: Optimized for bulk sends
- Database indexes on frequently queried columns

## Future Enhancements

- [ ] SMS notifications (Twilio integration)
- [ ] Slack/Discord webhooks
- [ ] Mobile app notifications (FCM/APNS)
- [ ] A/B testing framework
- [ ] Notification analytics dashboard
- [ ] Machine learning for optimal send times
- [ ] Rich media support (images, videos)
- [ ] Interactive notification actions

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review notification logs in database
3. Check server logs for errors
4. Create an issue in the GitHub repository

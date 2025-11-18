import { BaseNotificationProvider } from '../base/BaseNotificationProvider';
import {
  NotificationPayload,
  NotificationResult,
  NotificationChannel,
  ProviderConfig,
  EmailNotificationPayload,
} from '../types';

/**
 * Email provider using Resend API
 * Free tier: 3,000 emails/month, 100 emails/day
 * https://resend.com
 */
export class ResendEmailProvider extends BaseNotificationProvider {
  private apiKey: string;
  private defaultFrom: string;
  private baseUrl = 'https://api.resend.com';

  constructor(config: ProviderConfig) {
    super(config, NotificationChannel.EMAIL);

    if (!config.apiKey) {
      throw new Error('Resend API key is required');
    }

    this.apiKey = config.apiKey;
    this.defaultFrom = config.sender || 'NewsCurator AI <noreply@newscurator.ai>';
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.validatePayload(payload);

    if (!this.isEnabled()) {
      return {
        success: false,
        channel: this.channel,
        error: 'Email provider is disabled',
      };
    }

    try {
      const emailPayload = payload as EmailNotificationPayload;

      // Prepare email data
      const emailData = {
        from: emailPayload.from || this.defaultFrom,
        to: await this.getUserEmail(payload.userId),
        subject: emailPayload.subject || payload.title,
        html: emailPayload.htmlBody || this.generateHtmlBody(payload),
        text: payload.body,
        reply_to: emailPayload.replyTo,
        attachments: emailPayload.attachments,
      };

      // Send via Resend API
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json() as any;

      if (!response.ok) {
        throw new Error(result?.message || 'Failed to send email');
      }

      return {
        success: true,
        channel: this.channel,
        externalId: result?.id,
        metadata: {
          provider: 'resend',
          from: emailData.from,
          to: emailData.to,
        },
      };
    } catch (error) {
      console.error('Resend email error:', error);
      return {
        success: false,
        channel: this.channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Resend doesn't have a dedicated health endpoint
      // We'll just verify the API key is set
      return !!this.apiKey && this.isEnabled();
    } catch {
      return false;
    }
  }

  getMetadata() {
    return {
      name: 'Resend Email',
      channel: NotificationChannel.EMAIL,
      description: 'Email notifications via Resend API (3,000/month free)',
      rateLimit: {
        maxPerMinute: 10,
        maxPerDay: 100, // Free tier limit
      },
    };
  }

  /**
   * Generate HTML email body from plain text
   */
  private generateHtmlBody(payload: NotificationPayload): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #4F46E5;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #4F46E5;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      color: #1F2937;
      margin: 20px 0 10px 0;
    }
    .body {
      color: #4B5563;
      margin: 20px 0;
    }
    .action-button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4F46E5;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      font-size: 12px;
      color: #6B7280;
      text-align: center;
    }
    ${payload.imageUrl ? '.image { max-width: 100%; height: auto; border-radius: 8px; margin: 20px 0; }' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">NewsCurator AI</div>
    </div>
    <div class="title">${payload.title}</div>
    ${payload.imageUrl ? `<img src="${payload.imageUrl}" alt="Notification image" class="image">` : ''}
    <div class="body">
      ${payload.body.replace(/\n/g, '<br>')}
    </div>
    ${payload.actionUrl ? `<a href="${payload.actionUrl}" class="action-button">View Details</a>` : ''}
    <div class="footer">
      <p>You're receiving this email because you're subscribed to NewsCurator AI notifications.</p>
      <p><a href="${payload.actionUrl || '#'}">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get user email from user ID
   * This should be implemented to query the database
   */
  private async getUserEmail(userId: number): Promise<string> {
    // This will be injected via dependency injection in the actual service
    // For now, we'll throw an error if not provided
    throw new Error('getUserEmail must be implemented by the notification service');
  }
}

import { BaseNotificationProvider } from './base/BaseNotificationProvider';
import { ResendEmailProvider } from './providers/ResendEmailProvider';
import { InAppNotificationProvider } from './providers/InAppNotificationProvider';
import { WebPushProvider } from './providers/WebPushProvider';
import { NotificationChannel, ProviderConfig } from './types';

/**
 * Notification provider factory
 * Creates provider instances based on channel and configuration
 */
export class NotificationProviderFactory {
  /**
   * Create a notification provider instance
   */
  static createProvider(
    channel: NotificationChannel,
    config: ProviderConfig,
    dbClient?: any
  ): BaseNotificationProvider {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return new ResendEmailProvider(config);

      case NotificationChannel.IN_APP:
        return new InAppNotificationProvider(config, dbClient);

      case NotificationChannel.PUSH:
        return new WebPushProvider(config, dbClient);

      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }
  }

  /**
   * Create multiple providers at once
   */
  static createProviders(
    configs: Map<NotificationChannel, ProviderConfig>,
    dbClient?: any
  ): Map<NotificationChannel, BaseNotificationProvider> {
    const providers = new Map<NotificationChannel, BaseNotificationProvider>();

    configs.forEach((config, channel) => {
      if (config.enabled) {
        const provider = this.createProvider(channel, config, dbClient);
        providers.set(channel, provider);
      }
    });

    return providers;
  }

  /**
   * Get list of supported channels
   */
  static getSupportedChannels(): NotificationChannel[] {
    return [
      NotificationChannel.EMAIL,
      NotificationChannel.IN_APP,
      NotificationChannel.PUSH,
    ];
  }

  /**
   * Validate provider configuration
   */
  static validateConfig(channel: NotificationChannel, config: ProviderConfig): boolean {
    if (!config.enabled) {
      return true; // Disabled providers don't need validation
    }

    switch (channel) {
      case NotificationChannel.EMAIL:
        return !!config.apiKey;

      case NotificationChannel.IN_APP:
        return true; // No special config needed

      case NotificationChannel.PUSH:
        return !!(
          config.options?.vapidPublicKey &&
          config.options?.vapidPrivateKey
        );

      default:
        return false;
    }
  }
}

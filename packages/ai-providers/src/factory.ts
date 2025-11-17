import { AIProvider, AIProviderConfig } from '@news-curator/shared';
import { OpenRouterProvider } from './providers/OpenRouterProvider';

export class AIProviderFactory {
  /**
   * Create an AI provider instance based on configuration
   */
  static create(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'openrouter':
        return new OpenRouterProvider(config);

      case 'openai':
        throw new Error('OpenAI provider not yet implemented');

      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');

      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}

// Keep the function export for backward compatibility
export function createAIProvider(config: AIProviderConfig): AIProvider {
  return AIProviderFactory.create(config);
}

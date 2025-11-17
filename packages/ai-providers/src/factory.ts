import { AIProvider, AIProviderConfig } from '@news-curator/shared';
import { OpenRouterProvider } from './providers/OpenRouterProvider';

export function createAIProvider(config: AIProviderConfig): AIProvider {
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

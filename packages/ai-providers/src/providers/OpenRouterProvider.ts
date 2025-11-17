import axios, { AxiosInstance } from 'axios';
import { BaseAIProvider } from '../base/BaseAIProvider';
import { AIOperation, AIProviderConfig, AIProviderError } from '@news-curator/shared';
import PQueue from 'p-queue';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterProvider extends BaseAIProvider {
  name = 'openrouter';
  private client: AxiosInstance;
  private queue: PQueue;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    super();
    this.config = config;

    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://news-curator.com',
        'X-Title': 'NewsCurator AI',
        'Content-Type': 'application/json',
      },
      timeout: config.timeoutMs || 30000,
    });

    // Rate limiting: 10 concurrent requests
    this.queue = new PQueue({ concurrency: 10 });
  }

  protected async callAPI(
    prompt: string,
    systemPrompt?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{
    content: string;
    tokensUsed: { input: number; output: number; total: number };
  }> {
    return this.queue.add(async () => {
      const messages: OpenRouterMessage[] = [];

      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: prompt,
      });

      const request: OpenRouterRequest = {
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? this.config.temperature,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
      };

      try {
        const response = await this.client.post<OpenRouterResponse>(
          '/chat/completions',
          request
        );

        if (!response.data.choices || response.data.choices.length === 0) {
          throw new AIProviderError('No response from OpenRouter');
        }

        const content = response.data.choices[0].message.content;
        const usage = response.data.usage;

        return {
          content,
          tokensUsed: {
            input: usage.prompt_tokens,
            output: usage.completion_tokens,
            total: usage.total_tokens,
          },
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.error?.message || error.message;

          if (status === 429) {
            throw new AIProviderError('Rate limit exceeded', { retryAfter: 60 });
          }

          if (status === 401) {
            throw new AIProviderError('Invalid API key');
          }

          throw new AIProviderError(`OpenRouter API error: ${message}`, {
            status,
            data: error.response?.data,
          });
        }

        throw new AIProviderError(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }) as Promise<{
      content: string;
      tokensUsed: { input: number; output: number; total: number };
    }>;
  }

  estimateCost(
    operation: AIOperation,
    inputTokens: number,
    outputTokens: number = 0
  ): number {
    // OpenRouter pricing varies by model
    // These are approximate costs per 1M tokens
    const modelPricing: Record<string, { input: number; output: number }> = {
      'anthropic/claude-3-opus': { input: 15, output: 75 },
      'anthropic/claude-3-sonnet': { input: 3, output: 15 },
      'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
      'openai/gpt-4-turbo': { input: 10, output: 30 },
      'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      'meta-llama/llama-3-70b': { input: 0.9, output: 0.9 },
    };

    const pricing = modelPricing[this.config.model] || { input: 1, output: 2 };

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data.map((model: any) => model.id);
    } catch (error) {
      throw new AIProviderError('Failed to list models');
    }
  }
}

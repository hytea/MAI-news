import {
  AIProvider,
  AIOperation,
  AIRewriteResult,
  BiasAnalysis,
  StyleProfile,
  AIProviderError,
} from '@news-curator/shared';

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;

  protected abstract callAPI(
    prompt: string,
    systemPrompt?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{
    content: string;
    tokensUsed: { input: number; output: number; total: number };
  }>;

  async rewriteArticle(content: string, style: StyleProfile): Promise<AIRewriteResult> {
    const startTime = Date.now();

    const systemPrompt = this.buildRewriteSystemPrompt(style);
    const userPrompt = this.buildRewriteUserPrompt(content, style);

    try {
      const response = await this.callAPI(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      const processingTimeMs = Date.now() - startTime;
      const cost = this.estimateCost(
        AIOperation.REWRITE,
        response.tokensUsed.input,
        response.tokensUsed.output
      );

      return {
        content: response.content,
        processingTimeMs,
        tokensUsed: response.tokensUsed,
        cost,
      };
    } catch (error) {
      throw new AIProviderError(
        `Failed to rewrite article: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  async generateSummary(content: string, maxLength: number): Promise<string> {
    const prompt = `Summarize the following article in approximately ${maxLength} words. Be concise and capture the main points:\n\n${content}`;

    try {
      const response = await this.callAPI(prompt, undefined, {
        temperature: 0.5,
        maxTokens: Math.ceil(maxLength * 1.5),
      });

      return response.content;
    } catch (error) {
      throw new AIProviderError(
        `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  async extractKeyPoints(content: string, count: number = 5): Promise<string[]> {
    const prompt = `Extract exactly ${count} key points from the following article. Return them as a numbered list:\n\n${content}`;

    try {
      const response = await this.callAPI(prompt, undefined, {
        temperature: 0.3,
        maxTokens: 500,
      });

      // Parse the numbered list
      const lines = response.content.split('\n').filter(line => line.trim());
      const keyPoints = lines
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(point => point.length > 0)
        .slice(0, count);

      return keyPoints;
    } catch (error) {
      throw new AIProviderError(
        `Failed to extract key points: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  async detectBias(content: string): Promise<BiasAnalysis> {
    const prompt = `Analyze the following article for political or ideological bias. Provide:
1. Overall bias (left/center-left/center/center-right/right/unknown)
2. Confidence level (0-1)
3. Specific indicators of bias
4. Alternative perspectives that could balance the article

Article:
${content}

Respond in JSON format.`;

    try {
      const response = await this.callAPI(prompt, undefined, {
        temperature: 0.3,
        maxTokens: 1000,
      });

      // Parse JSON response
      const analysis = JSON.parse(response.content);
      return analysis;
    } catch (error) {
      // Return unknown bias if analysis fails
      return {
        overallBias: 'unknown',
        confidence: 0,
        indicators: [],
        alternativePerspectives: [],
      };
    }
  }

  async enrichWithContext(content: string, topic: string): Promise<string> {
    const prompt = `Enrich the following article about "${topic}" with additional context, background information, and relevant facts. Add context naturally without changing the core message:\n\n${content}`;

    try {
      const response = await this.callAPI(prompt, undefined, {
        temperature: 0.7,
        maxTokens: 5000,
      });

      return response.content;
    } catch (error) {
      throw new AIProviderError(
        `Failed to enrich with context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  abstract estimateCost(
    operation: AIOperation,
    inputTokens: number,
    outputTokens?: number
  ): number;

  protected buildRewriteSystemPrompt(style: StyleProfile): string {
    let basePrompt = 'You are an expert news writer who rewrites articles while maintaining accuracy and citing sources.';

    if (style.customPrompt) {
      return `${basePrompt}\n\n${style.customPrompt}`;
    }

    // Build prompt based on predefined style
    const toneMap = {
      formal: 'Use a formal, professional tone.',
      casual: 'Use a casual, conversational tone.',
      neutral: 'Use a balanced, neutral tone.',
    };

    const lengthMap = {
      concise: 'Be very concise. Aim for 50-70% of the original length.',
      medium: 'Aim for similar length to the original.',
      detailed: 'Provide detailed explanations. You may expand the content by 20-30%.',
    };

    const techLevelMap: Record<number, string> = {
      1: 'Write for a general audience with no technical knowledge.',
      5: 'Write for an informed reader with basic knowledge.',
      10: 'Write for an expert audience with deep technical knowledge.',
    };

    const techLevel =
      techLevelMap[style.technicalLevel] ||
      'Write for a reader with moderate technical knowledge.';

    return `${basePrompt}

${toneMap[style.tone]}
${lengthMap[style.length]}
${techLevel}

${style.includeKeyPoints ? 'Include key points at the beginning.' : ''}
${style.includeContext ? 'Add relevant context and background information.' : ''}

Maintain all factual information and cite sources appropriately.`;
  }

  protected buildRewriteUserPrompt(content: string, style: StyleProfile): string {
    return `Rewrite the following article according to the specified style:

${content}

Ensure the rewritten version:
1. Maintains all factual accuracy
2. Preserves the core message
3. Follows the specified tone and style
4. Includes proper citations where needed`;
  }
}

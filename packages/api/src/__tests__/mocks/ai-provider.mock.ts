export class MockAIProvider {
  rewriteArticle = jest.fn(async (article: any, stylePrompt: string) => {
    return {
      rewrittenContent: `Rewritten: ${article.content}`,
      summary: 'This is a test summary of the article.',
      keyPoints: [
        'Key point 1',
        'Key point 2',
        'Key point 3',
      ],
    };
  });

  generateSummary = jest.fn(async (content: string) => {
    return 'This is a generated summary.';
  });

  extractKeyPoints = jest.fn(async (content: string) => {
    return [
      'Extracted point 1',
      'Extracted point 2',
      'Extracted point 3',
    ];
  });

  estimateCost = jest.fn(async (content: string) => {
    return {
      inputTokens: 100,
      estimatedOutputTokens: 150,
      estimatedCostUSD: 0.001,
    };
  });

  healthCheck = jest.fn(async () => {
    return {
      status: 'healthy',
      provider: 'mock',
      timestamp: new Date().toISOString(),
    };
  });

  // Test helper to clear mocks
  clearMocks() {
    jest.clearAllMocks();
  }

  // Test helper to simulate errors
  simulateError(method: keyof MockAIProvider, error: Error) {
    (this[method] as jest.Mock).mockRejectedValueOnce(error);
  }

  // Test helper to simulate rate limiting
  simulateRateLimit() {
    const error = new Error('Rate limit exceeded');
    (error as any).status = 429;
    this.rewriteArticle.mockRejectedValueOnce(error);
  }
}

export const createMockAIProvider = (): MockAIProvider => {
  return new MockAIProvider();
};

// Mock AI response for article rewriting
export const mockAIRewriteResponse = {
  rewrittenContent: `
    <article>
      <p>This is a professionally rewritten version of the article.</p>
      <p>It maintains the key information while adapting the tone and style.</p>
    </article>
  `,
  summary: 'A concise summary of the article highlighting main points.',
  keyPoints: [
    'First important point from the article',
    'Second critical insight',
    'Third key takeaway',
  ],
  citations: [
    {
      text: 'Quote from the original source',
      source: 'Original Article',
      url: 'https://example.com/article',
    },
  ],
};

// Mock error responses
export const mockAIErrors = {
  rateLimitError: {
    message: 'Rate limit exceeded. Please try again later.',
    status: 429,
    code: 'RATE_LIMIT_EXCEEDED',
  },
  authError: {
    message: 'Invalid API key',
    status: 401,
    code: 'UNAUTHORIZED',
  },
  serverError: {
    message: 'AI service temporarily unavailable',
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
  },
};

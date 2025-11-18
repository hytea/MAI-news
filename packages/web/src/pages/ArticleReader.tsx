import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { Article, BiasAnalysis, EnrichedContext } from '../types';
import { StyleSwitcher } from '../components/StyleSwitcher';
import { SourcePanel } from '../components/SourcePanel';
import { BiasIndicator } from '../components/BiasIndicator';
import { KeyPointsPanel } from '../components/KeyPointsPanel';
import { ContextEnrichment } from '../components/ContextEnrichment';
import { formatDate } from '../utils/formatting';

export const ArticleReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [content, setContent] = useState('');
  const [currentStyle, setCurrentStyle] = useState<any>('original');
  const [loading, setLoading] = useState(true);
  const [styleLoading, setStyleLoading] = useState(false);
  const [error, setError] = useState('');

  // AI Features state
  const [biasAnalysis, setBiasAnalysis] = useState<BiasAnalysis | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[] | null>(null);
  const [enrichedContext, setEnrichedContext] = useState<EnrichedContext | null>(null);
  const [biasLoading, setBiasLoading] = useState(false);
  const [keyPointsLoading, setKeyPointsLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await apiClient.getArticle(id);
        setArticle(data);
        setContent(data.originalContent);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleStyleChange = async (style: any) => {
    if (!id || !article || style === currentStyle) return;

    setCurrentStyle(style);

    if (style === 'original') {
      setContent(article.originalContent);
      return;
    }

    try {
      setStyleLoading(true);
      const rewritten = await apiClient.getRewrittenArticle(id, style);
      if (rewritten) {
        setContent(rewritten.rewrittenContent);
        // Also update key points if available
        if (rewritten.keyPoints) {
          setKeyPoints(rewritten.keyPoints);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to rewrite article');
      setCurrentStyle('original');
      setContent(article.originalContent);
    } finally {
      setStyleLoading(false);
    }
  };

  // AI Feature handlers
  const handleAnalyzeBias = async () => {
    if (!id || biasLoading) return;

    try {
      setBiasLoading(true);
      const analysis = await apiClient.analyzeBias(id);
      setBiasAnalysis(analysis);
      setShowAIFeatures(true);
    } catch (err: any) {
      console.error('Failed to analyze bias:', err);
    } finally {
      setBiasLoading(false);
    }
  };

  const handleExtractKeyPoints = async () => {
    if (!id || keyPointsLoading) return;

    try {
      setKeyPointsLoading(true);
      const data = await apiClient.getKeyPoints(id, 5);
      setKeyPoints(data.keyPoints);
      setShowAIFeatures(true);
    } catch (err: any) {
      console.error('Failed to extract key points:', err);
    } finally {
      setKeyPointsLoading(false);
    }
  };

  const handleEnrichContext = async () => {
    if (!id || !article || contextLoading) return;

    try {
      setContextLoading(true);
      const data = await apiClient.enrichContext(id, article.title);
      setEnrichedContext(data);
      setShowAIFeatures(true);
    } catch (err: any) {
      console.error('Failed to enrich context:', err);
    } finally {
      setContextLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Article not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to feed
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <article className="bg-white rounded-lg shadow-sm p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block px-3 py-1 text-xs font-semibold text-primary-700 bg-primary-100 rounded">
                  {article.category}
                </span>
                <span className="text-sm text-gray-500">{article.source?.name || 'Unknown'}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-500">{formatDate(article.publishedAt)}</span>
              </div>

              <h1 className="text-4xl font-bold text-gray-900 mb-4">{article.title}</h1>

              {article.author && (
                <p className="text-gray-600">By {article.author}</p>
              )}
            </div>

            {article.imageUrl && (
              <div className="mb-8 rounded-lg overflow-hidden">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-full h-auto"
                />
              </div>
            )}

            <div className="prose prose-lg max-w-none">
              {content.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4 text-gray-800 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>

          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Features</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleAnalyzeBias}
                disabled={biasLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                {biasLoading ? 'Analyzing...' : 'Analyze Bias'}
              </button>
              <button
                onClick={handleExtractKeyPoints}
                disabled={keyPointsLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                {keyPointsLoading ? 'Extracting...' : 'Extract Key Points'}
              </button>
              <button
                onClick={handleEnrichContext}
                disabled={contextLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {contextLoading ? 'Enriching...' : 'Enrich Context'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            <StyleSwitcher
              currentStyle={currentStyle}
              onStyleChange={handleStyleChange}
              loading={styleLoading}
            />

            {/* AI Feature Components */}
            {showAIFeatures && (
              <>
                {keyPoints && (
                  <KeyPointsPanel keyPoints={keyPoints} loading={keyPointsLoading} />
                )}
                {biasAnalysis && (
                  <BiasIndicator biasAnalysis={biasAnalysis} loading={biasLoading} />
                )}
                {enrichedContext && (
                  <ContextEnrichment enrichedContext={enrichedContext} loading={contextLoading} />
                )}
              </>
            )}

            <SourcePanel
              sourceUrl={article.url}
              sourceName={article.source?.name || 'Unknown'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

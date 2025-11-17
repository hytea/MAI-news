import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { Article, StyleProfile, Citation } from '../types';
import { StyleSwitcher } from '../components/StyleSwitcher';
import { SourcePanel } from '../components/SourcePanel';
import { formatDate, formatReadingTime } from '../utils/formatting';

export const ArticleReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [content, setContent] = useState('');
  const [currentStyle, setCurrentStyle] = useState<StyleProfile>('original');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [styleLoading, setStyleLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await apiClient.getArticle(id);
        setArticle(data);
        setContent(data.originalContent);

        // Mark as read
        await apiClient.markArticleAsRead(id);

        // Fetch citations
        const citationData = await apiClient.getCitations(id);
        setCitations(citationData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleStyleChange = async (style: StyleProfile) => {
    if (!id || !article || style === currentStyle) return;

    setCurrentStyle(style);

    if (style === 'original') {
      setContent(article.originalContent);
      return;
    }

    try {
      setStyleLoading(true);
      const rewritten = await apiClient.getRewrittenArticle(id, style);
      setContent(rewritten.content);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to rewrite article');
      setCurrentStyle('original');
      setContent(article.originalContent);
    } finally {
      setStyleLoading(false);
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
                <span className="text-sm text-gray-500">{article.source}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-500">{formatDate(article.publishedAt)}</span>
                {article.readingTime && (
                  <>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-500">
                      {formatReadingTime(article.readingTime)}
                    </span>
                  </>
                )}
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
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <button className="flex items-center gap-2 text-gray-600 hover:text-primary-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                  Save
                </button>
                <button className="flex items-center gap-2 text-gray-600 hover:text-primary-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Share
                </button>
              </div>
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
            <SourcePanel
              sourceUrl={article.sourceUrl}
              sourceName={article.source}
              citations={citations}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

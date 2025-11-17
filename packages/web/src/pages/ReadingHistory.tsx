import React, { useState, useEffect } from 'react';
import { ArticleCard } from '../components/ArticleCard';
import { apiClient } from '../services/api';
import { Article } from '../types';

export const ReadingHistory: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getReadingHistory({ page, limit: 20 });
        setArticles((prev) => [...prev, ...response.data]);
        setHasMore(response.pagination.hasMore);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load reading history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [page]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reading History</h1>
        <p className="text-gray-600">Articles you've read recently</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading && articles.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {articles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p className="text-lg">No reading history yet</p>
              <p className="text-sm mt-2">Start reading articles to build your history</p>
            </div>
          ) : (
            <div>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}

              {hasMore && (
                <div className="flex justify-center py-8">
                  <button onClick={loadMore} disabled={loading} className="btn btn-primary">
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}

              {!hasMore && articles.length > 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>You've reached the end of your history!</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

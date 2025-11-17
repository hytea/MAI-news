import React, { useState, useEffect, useCallback } from 'react';
import { ArticleCard } from '../components/ArticleCard';
import { CategoryFilter } from '../components/CategoryFilter';
import { apiClient } from '../services/api';
import { Article, ArticleCategory } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export const NewsFeed: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | ''>('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 20;

  const fetchArticles = useCallback(
    async (currentOffset: number, isNewSearch = false) => {
      try {
        setLoading(true);
        const response = await apiClient.getArticles({
          limit,
          offset: currentOffset,
          category: selectedCategory || undefined,
          search: searchQuery || undefined,
          sortBy: 'published_at',
          sortOrder: 'desc',
        });

        if (isNewSearch) {
          setArticles(response.data);
        } else {
          setArticles((prev) => [...prev, ...response.data]);
        }

        setHasMore(response.pagination.hasMore);
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load articles');
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, searchQuery]
  );

  useEffect(() => {
    setOffset(0);
    fetchArticles(0, true);
  }, [selectedCategory, searchQuery, fetchArticles]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextOffset = offset + limit;
      setOffset(nextOffset);
      fetchArticles(nextOffset);
    }
  }, [loading, hasMore, offset, fetchArticles]);

  const { observerRef, resetFetching } = useInfiniteScroll(loadMore);

  useEffect(() => {
    if (!loading) {
      resetFetching();
    }
  }, [loading, resetFetching]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOffset(0);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your News Feed</h1>
        <p className="text-gray-600">Personalized news in your preferred style</p>
      </div>

      <div className="mb-6">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="input pr-10"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </form>
      </div>

      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

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
              <p className="text-lg">No articles found</p>
              <p className="text-sm mt-2">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}

              {hasMore && (
                <div ref={observerRef} className="py-8 flex justify-center">
                  {loading && (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  )}
                </div>
              )}

              {!hasMore && articles.length > 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>You've reached the end!</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

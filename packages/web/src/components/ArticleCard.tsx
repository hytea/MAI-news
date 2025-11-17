import React from 'react';
import { Link } from 'react-router-dom';
import { Article } from '../types';
import { formatTimeAgo, formatReadingTime, truncateText } from '../utils/formatting';

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article }) => {
  const excerpt = truncateText(
    article.rewrittenContent || article.originalContent,
    200
  );

  return (
    <Link to={`/article/${article.id}`}>
      <article className="card p-6 mb-4 cursor-pointer">
        <div className="flex gap-4">
          {article.imageUrl && (
            <div className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-200">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-2 py-1 text-xs font-semibold text-primary-700 bg-primary-100 rounded">
                {article.category}
              </span>
              <span className="text-xs text-gray-500">{article.source}</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                {formatTimeAgo(article.publishedAt)}
              </span>
              {article.readingTime && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">
                    {formatReadingTime(article.readingTime)}
                  </span>
                </>
              )}
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
              {article.title}
            </h3>

            <p className="text-gray-600 text-sm line-clamp-3 mb-3">{excerpt}</p>

            {article.author && (
              <p className="text-xs text-gray-500">By {article.author}</p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
};

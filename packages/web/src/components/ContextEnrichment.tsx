import React, { useState } from 'react';
import clsx from 'clsx';
import { EnrichedContext } from '../types';

interface ContextEnrichmentProps {
  enrichedContext: EnrichedContext | null;
  loading?: boolean;
}

export const ContextEnrichment: React.FC<ContextEnrichmentProps> = ({
  enrichedContext,
  loading = false,
}) => {
  const [showEnriched, setShowEnriched] = useState(true);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span>Enriching context...</span>
        </div>
      </div>
    );
  }

  if (!enrichedContext) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Context Enrichment
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEnriched(false)}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
              !showEnriched
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            Original
          </button>
          <button
            onClick={() => setShowEnriched(true)}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
              showEnriched
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            Enriched
          </button>
        </div>
      </div>

      <div className="relative">
        {!showEnriched && (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {enrichedContext.originalContent}
          </div>
        )}

        {showEnriched && (
          <div className="space-y-3">
            <div className="bg-primary-50 border-l-4 border-primary-600 p-3 rounded-r">
              <p className="text-xs font-semibold text-primary-800 mb-1">Topic: {enrichedContext.topic}</p>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {enrichedContext.enrichedContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Citation } from '../types';

interface SourcePanelProps {
  sourceUrl: string;
  sourceName: string;
  citations?: Citation[];
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sourceUrl,
  sourceName,
  citations = [],
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Sources</h3>

      <div className="mb-6">
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <svg
            className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 mb-1">Original Article</p>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline break-words"
            >
              {sourceName}
            </a>
          </div>
        </div>
      </div>

      {citations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Sources</h4>
          <div className="space-y-3">
            {citations.map((citation) => (
              <div key={citation.id} className="border-l-2 border-primary-200 pl-3">
                <p className="text-sm text-gray-700 mb-1">{citation.text}</p>
                <a
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {citation.sourceName}
                </a>
                {citation.reliability !== undefined && (
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${citation.reliability * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(citation.reliability * 100)}% reliable
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500 leading-relaxed">
          This article has been processed and rewritten by AI while maintaining factual accuracy.
          All claims are backed by sources listed above.
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import clsx from 'clsx';
import { StyleProfile } from '../types';
import { getStyleLabel } from '../utils/formatting';

const styles: StyleProfile[] = [
  'original',
  'conversational',
  'academic',
  'bullet-point',
  'eli5',
  'executive',
];

interface StyleSwitcherProps {
  currentStyle: StyleProfile;
  onStyleChange: (style: StyleProfile) => void;
  loading?: boolean;
}

export const StyleSwitcher: React.FC<StyleSwitcherProps> = ({
  currentStyle,
  onStyleChange,
  loading = false,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Reading Style</h3>
      <div className="flex flex-wrap gap-2">
        {styles.map((style) => (
          <button
            key={style}
            onClick={() => onStyleChange(style)}
            disabled={loading}
            className={clsx(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              currentStyle === style
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {getStyleLabel(style)}
          </button>
        ))}
      </div>
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span>Rewriting article...</span>
        </div>
      )}
    </div>
  );
};

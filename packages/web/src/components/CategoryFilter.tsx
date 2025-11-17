import React from 'react';
import clsx from 'clsx';
import { ArticleCategory } from '../types';

const categories: Array<{ label: string; value: ArticleCategory | '' }> = [
  { label: 'All', value: '' },
  { label: 'Politics', value: ArticleCategory.POLITICS },
  { label: 'Technology', value: ArticleCategory.TECHNOLOGY },
  { label: 'Business', value: ArticleCategory.BUSINESS },
  { label: 'Science', value: ArticleCategory.SCIENCE },
  { label: 'Health', value: ArticleCategory.HEALTH },
  { label: 'Sports', value: ArticleCategory.SPORTS },
  { label: 'Entertainment', value: ArticleCategory.ENTERTAINMENT },
  { label: 'World', value: ArticleCategory.WORLD },
];

interface CategoryFilterProps {
  selectedCategory: ArticleCategory | '';
  onSelectCategory: (category: ArticleCategory | '') => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex gap-2 pb-2">
        {categories.map((category) => (
          <button
            key={category.value || 'all'}
            onClick={() => onSelectCategory(category.value)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors',
              selectedCategory === category.value
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            )}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
};

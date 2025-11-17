import React from 'react';
import clsx from 'clsx';

const categories = [
  'All',
  'Politics',
  'Technology',
  'Business',
  'Science',
  'Health',
  'Sports',
  'Entertainment',
];

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
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
            key={category}
            onClick={() => onSelectCategory(category === 'All' ? '' : category)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors',
              selectedCategory === (category === 'All' ? '' : category)
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            )}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

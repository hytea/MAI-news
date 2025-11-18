import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ArticleCard } from '../ArticleCard';
import { Article } from '../../types';

const mockArticle: Article = {
  id: 'article-123',
  title: 'Test Article Title',
  originalContent: 'This is the original content of the test article. '.repeat(20),
  url: 'https://example.com/article',
  sourceId: 'source-123',
  author: 'Test Author',
  publishedAt: new Date('2024-01-15T10:00:00Z'),
  category: 'technology',
  imageUrl: 'https://example.com/image.jpg',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  source: {
    id: 'source-123',
    name: 'Test News',
    url: 'https://example.com',
    rssUrl: 'https://example.com/rss',
    category: 'technology',
    reliabilityScore: 85,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ArticleCard', () => {
  it('should render article title', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('Test Article Title')).toBeInTheDocument();
  });

  it('should render article author', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('By Test Author')).toBeInTheDocument();
  });

  it('should render article category', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  it('should render source name', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('Test News')).toBeInTheDocument();
  });

  it('should render reliability score', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('✓ 85% reliable')).toBeInTheDocument();
  });

  it('should render article image if provided', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    const image = screen.getByAlt('Test Article Title');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should not render image container if imageUrl is not provided', () => {
    const articleWithoutImage = { ...mockArticle, imageUrl: undefined };
    renderWithRouter(<ArticleCard article={articleWithoutImage} />);
    const images = screen.queryAllByRole('img');
    expect(images).toHaveLength(0);
  });

  it('should not render author if not provided', () => {
    const articleWithoutAuthor = { ...mockArticle, author: undefined };
    renderWithRouter(<ArticleCard article={articleWithoutAuthor} />);
    expect(screen.queryByText(/By /)).not.toBeInTheDocument();
  });

  it('should link to article detail page', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/article/article-123');
  });

  it('should truncate long content', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    const content = screen.getByText(/This is the original content/);
    expect(content.textContent?.length).toBeLessThan(mockArticle.originalContent.length);
  });

  it('should render without source information', () => {
    const articleWithoutSource = { ...mockArticle, source: undefined };
    renderWithRouter(<ArticleCard article={articleWithoutSource} />);
    expect(screen.getByText('Test Article Title')).toBeInTheDocument();
    expect(screen.queryByText('Test News')).not.toBeInTheDocument();
  });

  it('should render all metadata elements', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);

    // Check for category
    expect(screen.getByText('Technology')).toBeInTheDocument();

    // Check for time elements (there should be time-related text)
    const articleElement = screen.getByRole('article');
    expect(articleElement).toBeInTheDocument();

    // Check structure
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('should have correct CSS classes for styling', () => {
    renderWithRouter(<ArticleCard article={mockArticle} />);
    const articleElement = screen.getByRole('article');
    expect(articleElement).toHaveClass('card', 'p-6', 'mb-4', 'cursor-pointer');
  });
});

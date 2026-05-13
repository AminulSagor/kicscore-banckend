import { NewsArticle } from '../entities/news-article.entity';
import { NewsMappedEntity } from './news-entity-mapping.type';

export interface NewsArticleResponse {
  id: string;
  uuid: string;
  title: string;
  description: string | null;
  keywords: string | null;
  snippet: string | null;
  url: string;
  imageUrl: string | null;
  language: string | null;
  publishedAt: Date;
  source: string | null;
  categories: string[];
  locale: string | null;
  relevanceScore: number | null;
  mappedEntities: NewsMappedEntity[];
}

export interface PaginatedNewsArticleResponse {
  articles: NewsArticleResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SimilarNewsResponse {
  article: NewsArticleResponse;
  similar: NewsArticleResponse[];
}

export const mapNewsArticleResponse = (
  article: NewsArticle,
): NewsArticleResponse => {
  return {
    id: article.id,
    uuid: article.externalUuid,
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    snippet: article.snippet,
    url: article.url,
    imageUrl: article.imageUrl,
    language: article.language,
    publishedAt: article.publishedAt,
    source: article.source,
    categories: article.categories,
    locale: article.locale,
    relevanceScore: article.relevanceScore,
    mappedEntities: (article.mappedEntities ?? []) as NewsMappedEntity[],
  };
};

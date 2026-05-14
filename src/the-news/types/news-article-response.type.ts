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
    description: article.content?.description ?? null,
    keywords: article.content?.keywords ?? null,
    snippet: article.content?.snippet ?? null,
    url: article.url,
    imageUrl: article.content?.imageUrl ?? null,
    language: article.language,
    publishedAt: article.publishedAt,
    source: article.source?.sourceName ?? null,
    categories: article.categories?.map((category) => category.category) ?? [],
    locale: article.locale,
    relevanceScore: article.relevanceScore,
    mappedEntities:
      article.mappedEntities?.map((entity) => ({
        type: entity.entityType,
        name: entity.name,
        confidence: entity.confidence,
        matchedText: entity.matchedText,
      })) ?? [],
  };
};

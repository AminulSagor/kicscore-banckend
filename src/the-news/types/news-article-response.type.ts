import { FilesService } from 'src/modules/files/files.service';
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

// export const mapNewsArticleResponse = (
//   article: NewsArticle,
// ): NewsArticleResponse => {
//   return {
//     id: article.id,
//     uuid: article.externalUuid,
//     title: article.title,
//     description: article.content?.description ?? null,
//     keywords: article.content?.keywords ?? null,
//     snippet: article.content?.snippet ?? null,
//     url: article.url,
//     imageUrl: article.content?.imageUrl ?? null,
//     language: article.language,
//     publishedAt: article.publishedAt,
//     source: article.source?.sourceName ?? null,
//     categories: article.categories?.map((category) => category.category) ?? [],
//     locale: article.locale,
//     relevanceScore: article.relevanceScore,
//     mappedEntities:
//       article.mappedEntities?.map((entity) => ({
//         type: entity.entityType,
//         name: entity.name,
//         confidence: entity.confidence,
//         matchedText: entity.matchedText,
//       })) ?? [],
//   };
// };

export const mapNewsArticleResponse = async (
  article: NewsArticle,
  filesService?: FilesService, // Optional, so existing tests don't break immediately
): Promise<any> => {
  let finalImageUrl = article.content?.imageUrl ?? null;

  // If we detect an internal S3 file, fetch the signed URL dynamically
  if (
    finalImageUrl &&
    finalImageUrl.startsWith('kicscore-file:') &&
    filesService
  ) {
    const fileId = finalImageUrl.replace('kicscore-file:', '');
    const signedUrl = await filesService.createSystemSignedReadUrl(fileId);

    if (signedUrl) {
      finalImageUrl = signedUrl;
    }
  }

  return {
    id: article.id,
    uuid: article.externalUuid,
    title: article.title,
    description: article.content?.description ?? null,
    keywords: article.content?.keywords ?? null,
    snippet: article.content?.snippet ?? null,
    url: article.url,
    imageUrl: finalImageUrl,
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

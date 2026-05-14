import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { TheNewsClient } from '../clients/the-news.client';
import { ListSportsNewsQueryDto } from '../dto/list-sports-news-query.dto';
import { NewsFeedQueryDto } from '../dto/news-feed-query.dto';
import { NewsSimilarQueryDto } from '../dto/news-similar-query.dto';
import { NewsArticleCategory } from '../entities/news-article-category.entity';
import { NewsArticleContent } from '../entities/news-article-content.entity';
import { NewsArticleMappedEntity } from '../entities/news-article-mapped-entity.entity';
import { NewsArticlePayloadItem } from '../entities/news-article-payload-item.entity';
import { NewsArticleSource } from '../entities/news-article-source.entity';
import { NewsArticle } from '../entities/news-article.entity';
import {
  PaginatedNewsArticleResponse,
  SimilarNewsResponse,
  mapNewsArticleResponse,
} from '../types/news-article-response.type';
import { NewsMappedEntity } from '../types/news-entity-mapping.type';
import {
  TheNewsApiArticle,
  TheNewsApiListResponse,
} from '../types/the-news-api.type';
import { NewsEntityMapperService } from './news-entity-mapper.service';

@Injectable()
export class TheNewsService {
  private readonly logger = new Logger(TheNewsService.name);

  constructor(
    private readonly theNewsClient: TheNewsClient,
    private readonly newsEntityMapperService: NewsEntityMapperService,

    @InjectRepository(NewsArticle)
    private readonly newsArticleRepository: Repository<NewsArticle>,

    @InjectRepository(NewsArticleContent)
    private readonly newsArticleContentRepository: Repository<NewsArticleContent>,

    @InjectRepository(NewsArticleSource)
    private readonly newsArticleSourceRepository: Repository<NewsArticleSource>,

    @InjectRepository(NewsArticleCategory)
    private readonly newsArticleCategoryRepository: Repository<NewsArticleCategory>,

    @InjectRepository(NewsArticleMappedEntity)
    private readonly newsArticleMappedEntityRepository: Repository<NewsArticleMappedEntity>,

    @InjectRepository(NewsArticlePayloadItem)
    private readonly newsArticlePayloadItemRepository: Repository<NewsArticlePayloadItem>,
  ) {}

  async syncSportsNews(): Promise<{
    fetched: number;
    saved: number;
  }> {
    const limit = Number(process.env.THENEWS_SPORTS_LIMIT ?? 50);
    const language = process.env.THENEWS_SPORTS_LANGUAGE ?? 'en';

    const response = await this.theNewsClient.get<TheNewsApiListResponse>(
      '/news/top',
      {
        categories: 'sports',
        language,
        limit,
        page: 1,
      },
    );

    const articles = Array.isArray(response.data) ? response.data : [];
    const sportsArticles = articles.filter((article) =>
      this.isValidSportsArticle(article),
    );

    if (!sportsArticles.length) {
      this.logger.warn('No sports news articles found from TheNewsAPI');

      return {
        fetched: articles.length,
        saved: 0,
      };
    }

    let saved = 0;

    for (const article of sportsArticles) {
      await this.saveArticle(article);
      saved += 1;
    }

    return {
      fetched: articles.length,
      saved,
    };
  }

  async getNewsFeed(
    query: NewsFeedQueryDto,
  ): Promise<PaginatedNewsArticleResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [articles, total] = await this.newsArticleRepository.findAndCount({
      relations: {
        content: true,
        source: true,
        categories: true,
        mappedEntities: true,
      },
      order: {
        publishedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      articles: articles.map(mapNewsArticleResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSportsNews(
    query: ListSportsNewsQueryDto,
  ): Promise<PaginatedNewsArticleResponse> {
    return this.getNewsFeed(query);
  }

  async getArticleByUuid(uuid: string): Promise<NewsArticle> {
    const article = await this.newsArticleRepository.findOne({
      where: {
        externalUuid: uuid,
      },
      relations: {
        content: true,
        source: true,
        categories: true,
        mappedEntities: true,
        payloadItems: true,
      },
    });

    if (!article) {
      throw new NotFoundException('News article not found');
    }

    return article;
  }

  async getSimilarArticles(
    uuid: string,
    query?: NewsSimilarQueryDto,
  ): Promise<SimilarNewsResponse> {
    const limit = query?.limit ?? 5;
    const baseArticle = await this.getArticleByUuid(uuid);

    const candidateArticles = await this.newsArticleRepository.find({
      relations: {
        content: true,
        source: true,
        categories: true,
        mappedEntities: true,
      },
      order: {
        publishedAt: 'DESC',
      },
      take: 100,
    });

    const rankedArticles = candidateArticles
      .filter((article) => article.externalUuid !== baseArticle.externalUuid)
      .map((article) => ({
        article,
        score: this.scoreSimilarity(baseArticle, article),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ article }) => mapNewsArticleResponse(article));

    return {
      article: mapNewsArticleResponse(baseArticle),
      similar: rankedArticles,
    };
  }

  async deleteArticlesOlderThanThirtyDays(): Promise<{
    deleted: number;
    cutoffDate: Date;
  }> {
    const retentionDays = this.getRetentionDays();
    const cutoffDate = new Date();

    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.newsArticleRepository.delete({
      publishedAt: LessThan(cutoffDate),
    });

    return {
      deleted: result.affected ?? 0,
      cutoffDate,
    };
  }

  private async saveArticle(article: TheNewsApiArticle): Promise<NewsArticle> {
    const now = new Date();

    let newsArticle = await this.newsArticleRepository.findOne({
      where: {
        externalUuid: article.uuid,
      },
    });

    if (!newsArticle) {
      newsArticle = this.newsArticleRepository.create({
        externalUuid: article.uuid,
      });
    }

    newsArticle.title = article.title;
    newsArticle.url = article.url;
    newsArticle.language = article.language ?? null;
    newsArticle.locale = article.locale ?? null;
    newsArticle.relevanceScore = article.relevance_score ?? null;
    newsArticle.publishedAt = new Date(article.published_at);
    newsArticle.lastFetchedAt = now;

    const savedArticle = await this.newsArticleRepository.save(newsArticle);

    await this.saveContent(savedArticle.id, article);
    await this.saveSource(savedArticle.id, article);
    await this.syncCategories(savedArticle.id, article.categories ?? []);
    await this.syncMappedEntities(
      savedArticle.id,
      this.newsEntityMapperService.mapArticle(article),
    );
    await this.syncPayloadItems(savedArticle.id, article);

    return savedArticle;
  }

  private async saveContent(
    articleId: string,
    article: TheNewsApiArticle,
  ): Promise<void> {
    let content = await this.newsArticleContentRepository.findOne({
      where: {
        articleId,
      },
    });

    if (!content) {
      content = this.newsArticleContentRepository.create({
        articleId,
      });
    }

    content.description = article.description ?? null;
    content.keywords = article.keywords ?? null;
    content.snippet = article.snippet ?? null;
    content.imageUrl = article.image_url ?? null;

    await this.newsArticleContentRepository.save(content);
  }

  private async saveSource(
    articleId: string,
    article: TheNewsApiArticle,
  ): Promise<void> {
    let source = await this.newsArticleSourceRepository.findOne({
      where: {
        articleId,
      },
    });

    if (!source) {
      source = this.newsArticleSourceRepository.create({
        articleId,
      });
    }

    source.sourceName = article.source ?? null;

    await this.newsArticleSourceRepository.save(source);
  }

  private async syncCategories(
    articleId: string,
    categories: string[],
  ): Promise<void> {
    await this.newsArticleCategoryRepository.delete({
      articleId,
    });

    const items = categories
      .filter((category) => category.trim().length > 0)
      .map((category) =>
        this.newsArticleCategoryRepository.create({
          articleId,
          category,
        }),
      );

    if (items.length) {
      await this.newsArticleCategoryRepository.save(items);
    }
  }

  private async syncMappedEntities(
    articleId: string,
    mappedEntities: NewsMappedEntity[],
  ): Promise<void> {
    await this.newsArticleMappedEntityRepository.delete({
      articleId,
    });

    const items = mappedEntities.map((entity) =>
      this.newsArticleMappedEntityRepository.create({
        articleId,
        entityType: entity.type,
        name: entity.name,
        confidence: entity.confidence,
        matchedText: entity.matchedText,
      }),
    );

    if (items.length) {
      await this.newsArticleMappedEntityRepository.save(items);
    }
  }

  private async syncPayloadItems(
    articleId: string,
    article: TheNewsApiArticle,
  ): Promise<void> {
    await this.newsArticlePayloadItemRepository.delete({
      articleId,
    });

    const items = Object.entries(article)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) =>
        this.newsArticlePayloadItemRepository.create({
          articleId,
          key,
          value:
            typeof value === 'string' || typeof value === 'number'
              ? String(value)
              : JSON.stringify(value),
        }),
      );

    if (items.length) {
      await this.newsArticlePayloadItemRepository.save(items);
    }
  }

  private getRetentionDays(): number {
    const rawValue = process.env.THENEWS_RETENTION_DAYS;
    const parsedValue = Number(rawValue ?? 30);

    if (!rawValue) {
      return 30;
    }

    return Number.isNaN(parsedValue) || parsedValue <= 0 ? 30 : parsedValue;
  }

  private scoreSimilarity(
    baseArticle: NewsArticle,
    candidate: NewsArticle,
  ): number {
    let score = 0;

    const baseCategories = new Set(
      baseArticle.categories?.map((category) => category.category) ?? [],
    );
    const candidateCategories = new Set(
      candidate.categories?.map((category) => category.category) ?? [],
    );

    for (const category of candidateCategories) {
      if (baseCategories.has(category)) {
        score += 3;
      }
    }

    if (
      baseArticle.source?.sourceName &&
      candidate.source?.sourceName &&
      baseArticle.source.sourceName === candidate.source.sourceName
    ) {
      score += 1;
    }

    for (const baseEntity of baseArticle.mappedEntities ?? []) {
      for (const candidateEntity of candidate.mappedEntities ?? []) {
        if (
          baseEntity.entityType === candidateEntity.entityType &&
          baseEntity.name.toLowerCase() === candidateEntity.name.toLowerCase()
        ) {
          score += 4;
        }
      }
    }

    score += this.getTokenOverlapScore(baseArticle.title, candidate.title);

    const timeDifferenceHours =
      Math.abs(
        baseArticle.publishedAt.getTime() - candidate.publishedAt.getTime(),
      ) /
      (1000 * 60 * 60);

    if (timeDifferenceHours <= 24) {
      score += 2;
    } else if (timeDifferenceHours <= 72) {
      score += 1;
    }

    return score;
  }

  private getTokenOverlapScore(leftText: string, rightText: string): number {
    const leftTokens = new Set(this.normalizeText(leftText));
    const rightTokens = new Set(this.normalizeText(rightText));
    let overlap = 0;

    for (const token of leftTokens) {
      if (rightTokens.has(token)) {
        overlap += 1;
      }
    }

    return overlap > 0 ? Math.min(overlap, 3) : 0;
  }

  private normalizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3);
  }

  private isValidSportsArticle(article: TheNewsApiArticle): boolean {
    if (
      !article.uuid ||
      !article.title ||
      !article.url ||
      !article.published_at
    ) {
      return false;
    }

    return article.categories?.includes('sports') ?? false;
  }
}

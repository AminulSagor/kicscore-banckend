import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, LessThan, Repository } from 'typeorm';

import { TheNewsClient } from '../clients/the-news.client';
import { ListSportsNewsQueryDto } from '../dto/list-sports-news-query.dto';
import { NewsFeedQueryDto } from '../dto/news-feed-query.dto';
import { NewsSimilarQueryDto } from '../dto/news-similar-query.dto';
import { NewsArticle } from '../entities/news-article.entity';
import {
  PaginatedNewsArticleResponse,
  SimilarNewsResponse,
  mapNewsArticleResponse,
} from '../types/news-article-response.type';
import {
  NewsMappedEntity,
} from '../types/news-entity-mapping.type';
import {
  TheNewsApiArticle,
  TheNewsApiListResponse,
} from '../types/the-news-api.type';
import { NewsEntityMapperService } from './news-entity-mapper.service';
import { RedisService } from '../../redis/redis.service';

const DEFAULT_FEED_CACHE_TTL_SECONDS = 15 * 60;
const DEFAULT_FEED_CACHE_STALE_SECONDS = 60 * 60;

@Injectable()
export class TheNewsService {
  private readonly logger = new Logger(TheNewsService.name);

  constructor(
    private readonly theNewsClient: TheNewsClient,
    private readonly redisService: RedisService,
    private readonly newsEntityMapperService: NewsEntityMapperService,

    @InjectRepository(NewsArticle)
    private readonly newsArticleRepository: Repository<NewsArticle>,
  ) {}

  private getRetentionDays(): number {
    const rawValue = process.env.THENEWS_RETENTION_DAYS;
    const parsedValue = Number(rawValue ?? 30);

    if (!rawValue) {
      return 30;
    }

    return Number.isNaN(parsedValue) || parsedValue <= 0 ? 30 : parsedValue;
  }

  private getFeedCacheTtlSeconds(): number {
    const rawValue = process.env.THENEWS_FEED_CACHE_TTL_SECONDS;
    const parsedValue = Number(rawValue ?? DEFAULT_FEED_CACHE_TTL_SECONDS);

    return Number.isNaN(parsedValue) || parsedValue <= 0
      ? DEFAULT_FEED_CACHE_TTL_SECONDS
      : parsedValue;
  }

  private getFeedCacheStaleSeconds(): number {
    const rawValue = process.env.THENEWS_FEED_CACHE_STALE_SECONDS;
    const parsedValue = Number(rawValue ?? DEFAULT_FEED_CACHE_STALE_SECONDS);

    return Number.isNaN(parsedValue) || parsedValue <= 0
      ? DEFAULT_FEED_CACHE_STALE_SECONDS
      : parsedValue;
  }

  private buildFeedCacheKey(page: number, limit: number): string {
    return `the-news:feed:sports:page:${page}:limit:${limit}`;
  }

  private buildArticleCacheKey(uuid: string): string {
    return `the-news:article:${uuid}`;
  }

  private buildSimilarCacheKey(uuid: string, limit: number): string {
    return `the-news:similar:${uuid}:limit:${limit}`;
  }

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

    if (sportsArticles.length === 0) {
      this.logger.warn('No sports news articles found from TheNewsAPI');

      return {
        fetched: articles.length,
        saved: 0,
      };
    }

    const now = new Date();

    const articlePayloads: DeepPartial<NewsArticle>[] = sportsArticles.map(
      (article) => ({
        externalUuid: article.uuid,
        title: article.title,
        description: article.description ?? null,
        keywords: article.keywords ?? null,
        snippet: article.snippet ?? null,
        url: article.url,
        imageUrl: article.image_url ?? null,
        language: article.language ?? null,
        publishedAt: new Date(article.published_at),
        source: article.source ?? null,
        categories: article.categories ?? [],
        locale: article.locale ?? null,
        relevanceScore: article.relevance_score ?? null,
        rawPayload: article as unknown as Record<string, any>,
        mappedEntities: this.newsEntityMapperService.mapArticle(article) as unknown as NewsMappedEntity[],
        lastFetchedAt: now,
      }),
    );

    await this.newsArticleRepository.upsert(articlePayloads, ['externalUuid']);

    return {
      fetched: articles.length,
      saved: articlePayloads.length,
    };
  }

  async getNewsFeed(
    query: NewsFeedQueryDto,
  ): Promise<PaginatedNewsArticleResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const cacheKey = this.buildFeedCacheKey(page, limit);
    const staleKey = `${cacheKey}:stale`;

    const cachedFeed = await this.redisService.get<PaginatedNewsArticleResponse>(
      cacheKey,
    );

    if (cachedFeed) {
      return cachedFeed;
    }

    const [articles, total] = await this.newsArticleRepository.findAndCount({
      order: {
        publishedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const response: PaginatedNewsArticleResponse = {
      articles: articles.map(mapNewsArticleResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(
      cacheKey,
      response,
      this.getFeedCacheTtlSeconds(),
    );
    await this.redisService.set(
      staleKey,
      response,
      this.getFeedCacheStaleSeconds(),
    );

    return response;
  }

  async getSportsNews(
    query: ListSportsNewsQueryDto,
  ): Promise<PaginatedNewsArticleResponse> {
    return this.getNewsFeed(query);
  }

  async getArticleByUuid(uuid: string): Promise<NewsArticle> {
    const article = await this.newsArticleRepository.findOne({
      where: { externalUuid: uuid },
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
    const cacheKey = this.buildSimilarCacheKey(uuid, limit);

    const cachedResponse = await this.redisService.get<SimilarNewsResponse>(
      cacheKey,
    );

    if (cachedResponse) {
      return cachedResponse;
    }

    const baseArticle = await this.getArticleByUuid(uuid);

    const candidateArticles = await this.newsArticleRepository.find({
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

    const response: SimilarNewsResponse = {
      article: mapNewsArticleResponse(baseArticle),
      similar: rankedArticles,
    };

    await this.redisService.set(cacheKey, response, this.getFeedCacheTtlSeconds());

    return response;
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

  private scoreSimilarity(baseArticle: NewsArticle, candidate: NewsArticle): number {
    let score = 0;

    const baseCategories = new Set(baseArticle.categories ?? []);
    const candidateCategories = new Set(candidate.categories ?? []);

    for (const category of candidateCategories) {
      if (baseCategories.has(category)) {
        score += 3;
      }
    }

    if (baseArticle.source && candidate.source && baseArticle.source === candidate.source) {
      score += 1;
    }

    const baseEntities = baseArticle.mappedEntities ?? [];
    const candidateEntities = candidate.mappedEntities ?? [];

    for (const baseEntity of baseEntities) {
      for (const candidateEntity of candidateEntities) {
        if (
          this.isSameMappedEntity(baseEntity, candidateEntity)
        ) {
          score += 4;
        }
      }
    }

    const titleOverlap = this.getTokenOverlapScore(baseArticle.title, candidate.title);
    score += titleOverlap;

    const timeDifferenceHours = Math.abs(
      baseArticle.publishedAt.getTime() - candidate.publishedAt.getTime(),
    ) / (1000 * 60 * 60);

    if (timeDifferenceHours <= 24) {
      score += 2;
    } else if (timeDifferenceHours <= 72) {
      score += 1;
    }

    return score;
  }

  private isSameMappedEntity(left: NewsMappedEntity, right: NewsMappedEntity): boolean {
    return (
      left?.type === right?.type &&
      typeof left?.name === 'string' &&
      typeof right?.name === 'string' &&
      left.name.toLowerCase() === right.name.toLowerCase()
    );
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
    if (!article.uuid || !article.title || !article.url || !article.published_at) {
      return false;
    }

    return article.categories?.includes('sports') ?? false;
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
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
  NewsArticleResponse,
  PaginatedNewsArticleResponse,
  SimilarNewsResponse,
  mapNewsArticleResponse,
} from '../types/news-article-response.type';
import { getBooleanEnv } from 'src/common/utils/env.util';

// Titles from external APIs that should be ignored entirely (not stored or served)
const IGNORED_API_TITLE = 'sportsnet.ca';
import { NewsMappedEntity } from '../types/news-entity-mapping.type';
import {
  TheNewsApiArticle,
  TheNewsApiListResponse,
} from '../types/the-news-api.type';
import { NewsEntityMapperService } from './news-entity-mapper.service';
import { FilesService } from 'src/modules/files/files.service';
import { CreateCustomNewsDto } from '../dto/create-custom-news.dto';
import { UpdateCustomNewsDto } from '../dto/update-custom-news.dto';
import { AdminNewsQueryDto } from '../dto/admin-news-query.dto';

@Injectable()
export class TheNewsService {
  private readonly logger = new Logger(TheNewsService.name);

  constructor(
    private readonly theNewsClient: TheNewsClient,
    private readonly newsEntityMapperService: NewsEntityMapperService,
    private readonly filesService: FilesService,

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
    const sportsArticles = articles
      .filter((article) => this.isValidSportsArticle(article))
      .filter((article) =>
        String(article.title ?? '').toLowerCase().trim() !== IGNORED_API_TITLE,
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

  // Decide whether to restrict sources based on AdsenceApprove env var.
  // Use helper so a missing env var defaults to false in production.
  const adsenceApprove = getBooleanEnv('AdsenceApprove', false);

    const queryBuilder = this.newsArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.content', 'content')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.categories', 'categories')
      .leftJoinAndSelect('article.mappedEntities', 'mappedEntities')
      .orderBy('article.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!adsenceApprove) {
      // When AdsenceApprove is false, only show articles whose source is exactly 'kicscore.com'
      queryBuilder.andWhere('source.sourceName = :sourceName', {
        sourceName: 'kicscore.com',
      });
    }

    // Always exclude ignored API titles from feeds
    queryBuilder.andWhere('LOWER(article.title) != :ignoredTitle', {
      ignoredTitle: IGNORED_API_TITLE,
    });

    const [articles, total] = await queryBuilder.getManyAndCount();

    const mappedArticles = await Promise.all(
      articles.map((article) => mapNewsArticleResponse(article, this.filesService)),
    );

    return {
      articles: mappedArticles,
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

    // Respect AdsenceApprove env flag: when false (or missing) only consider
    // `kicscore.com` source articles as candidates for similarity.
    const adsenceApprove = getBooleanEnv('AdsenceApprove', false);

    const candidateQuery = this.newsArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.content', 'content')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.categories', 'categories')
      .leftJoinAndSelect('article.mappedEntities', 'mappedEntities')
      .orderBy('article.publishedAt', 'DESC')
      .take(100);

    if (!adsenceApprove) {
      candidateQuery.andWhere('source.sourceName = :sourceName', {
        sourceName: 'kicscore.com',
      });
    }

    // Exclude ignored API titles from similarity candidates
    candidateQuery.andWhere('LOWER(article.title) != :ignoredTitle', {
      ignoredTitle: IGNORED_API_TITLE,
    });

    const candidateArticles = await candidateQuery.getMany();

    const rankedArticles = candidateArticles
      .filter((article) => article.externalUuid !== baseArticle.externalUuid)
      .map((article) => ({
        article,
        score: this.scoreSimilarity(baseArticle, article),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ article }) => article);

    const [mappedBaseArticle, mappedSimilarArticles] = await Promise.all([
      mapNewsArticleResponse(baseArticle, this.filesService),
      Promise.all(
        rankedArticles.map((article) =>
          mapNewsArticleResponse(article, this.filesService),
        ),
      ),
    ]);

    return {
      article: mappedBaseArticle,
      similar: mappedSimilarArticles,
    };
  }

  private async saveArticle(article: TheNewsApiArticle): Promise<NewsArticle> {
    const now = new Date();

    // Defensive: do not save articles that come from external APIs with ignored titles
    if (String(article.title ?? '').toLowerCase().trim() === IGNORED_API_TITLE) {
      this.logger.log('Skipping ignored external article by title: ' + article.title);
      throw new BadRequestException('Ignored external article');
    }

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

  async createCustomArticle(
    adminUserId: string,
    dto: CreateCustomNewsDto,
  ): Promise<any> {
    let imageUrl: string | null = null;
    let readUrlResponse: string | null = null;

    // 1. Resolve S3 Image if provided
    if (dto.imageId) {
      // Validates file exists and gets the signed URL
      const signedUrlData = await this.filesService.createSignedReadUrl(
        adminUserId,
        dto.imageId,
      );

      // Store a reference so the frontend/API knows this is an internal S3 file
      imageUrl = `kicscore-file:${dto.imageId}`;
      readUrlResponse = signedUrlData.readUrl;
    }

    const externalUuid = uuidv4();
    const now = new Date();

    // 2. Create Base Article
    const newsArticle = this.newsArticleRepository.create({
      externalUuid,
      title: dto.title,
      url: `https://kicscore.com/news/${externalUuid}`, // Your internal deep-link
      language: 'en',
      locale: 'en-US',
      relevanceScore: 100, // Custom news can be weighted higher
      publishedAt: now,
      lastFetchedAt: now,
    });

    const savedArticle = await this.newsArticleRepository.save(newsArticle);

    // 3. Create Content
    await this.newsArticleContentRepository.save(
      this.newsArticleContentRepository.create({
        articleId: savedArticle.id,
        description: dto.description,
        snippet: dto.snippet,
        keywords: dto.keywords ?? null,
        imageUrl,
      }),
    );

    // 4. Create Source (Default: kicscore.com)
    await this.newsArticleSourceRepository.save(
      this.newsArticleSourceRepository.create({
        articleId: savedArticle.id,
        sourceName: 'kicscore.com',
      }),
    );

    // 5. Create Category (Default: sports)
    await this.newsArticleCategoryRepository.save(
      this.newsArticleCategoryRepository.create({
        articleId: savedArticle.id,
        category: 'sports',
      }),
    );

    // 6. Map Entities (NLP) using a mock API object so your regex logic works
    const mockApiArticle = {
      title: dto.title,
      description: dto.description,
      snippet: dto.snippet,
      keywords: dto.keywords ?? '',
    } as any; // Cast as any or TheNewsApiArticle to satisfy the mapper

    const mappedEntities =
      this.newsEntityMapperService.mapArticle(mockApiArticle);
    await this.syncMappedEntities(savedArticle.id, mappedEntities);

    // 7. Fetch the complete saved article for the response
    const completeArticle = await this.getArticleByUuid(externalUuid);

    return {
      article: completeArticle,
      imageReadUrl: readUrlResponse, // Return the immediate read URL for the admin panel
    };
  }

  async getAdminNews(
    query: AdminNewsQueryDto,
    customOnly: boolean = false,
  ): Promise<PaginatedNewsArticleResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const queryBuilder = this.newsArticleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.content', 'content')
      .leftJoinAndSelect('article.source', 'source')
      .leftJoinAndSelect('article.categories', 'categories')
      .leftJoinAndSelect('article.mappedEntities', 'mappedEntities');

    if (customOnly) {
      queryBuilder.andWhere('source.sourceName = :sourceName', {
        sourceName: 'kicscore.com',
      });
    }

    if (query.search) {
      queryBuilder.andWhere('article.title ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    queryBuilder.orderBy('article.publishedAt', 'DESC');
    queryBuilder.skip((page - 1) * limit);
    queryBuilder.take(limit);

    const [articles, total] = await queryBuilder.getManyAndCount();

    const mappedArticles = await Promise.all(
      articles.map((article) =>
        mapNewsArticleResponse(article, this.filesService),
      ),
    );

    return {
      articles: mappedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCustomArticle(
    adminUserId: string,
    uuid: string,
    dto: UpdateCustomNewsDto,
  ): Promise<NewsArticleResponse> {
    const article = await this.getArticleByUuid(uuid);

    if (article.source?.sourceName !== 'kicscore.com') {
      throw new BadRequestException('You can only edit custom news articles.');
    }

    let needsMappingUpdate = false;

    // 1. Update Base Article
    if (dto.title) {
      article.title = dto.title;
      needsMappingUpdate = true;
    }

    await this.newsArticleRepository.save(article);

    // 2. Update Content
    if (article.content) {
      if (dto.description !== undefined) {
        article.content.description = dto.description;
        needsMappingUpdate = true;
      }
      if (dto.snippet !== undefined) {
        article.content.snippet = dto.snippet;
        needsMappingUpdate = true;
      }
      if (dto.keywords !== undefined) {
        article.content.keywords = dto.keywords;
        needsMappingUpdate = true;
      }

      if (dto.imageId) {
        const signedUrlData = await this.filesService.createSignedReadUrl(
          adminUserId,
          dto.imageId,
        );
        article.content.imageUrl = `kicscore-file:${signedUrlData.fileKey}`;
      }

      await this.newsArticleContentRepository.save(article.content);
    }

    // 3. Re-run Entity NLP mapping if text changed
    if (needsMappingUpdate) {
      const mockApiArticle = {
        title: article.title,
        description: article.content?.description ?? '',
        snippet: article.content?.snippet ?? '',
        keywords: article.content?.keywords ?? '',
      } as any;

      const mappedEntities =
        this.newsEntityMapperService.mapArticle(mockApiArticle);
      await this.syncMappedEntities(article.id, mappedEntities);
    }

    // Return the fresh mapped data
    const updatedArticle = await this.getArticleByUuid(uuid);
    return await mapNewsArticleResponse(updatedArticle, this.filesService);
  }

  async deleteArticle(uuid: string): Promise<void> {
    const article = await this.newsArticleRepository.findOne({
      where: { externalUuid: uuid },
    });

    if (!article) {
      throw new NotFoundException('News article not found');
    }

    // Thanks to your `onDelete: 'CASCADE'` in the TypeORM entities,
    // this single line will safely delete the content, categories, sources, and entities!
    await this.newsArticleRepository.remove(article);
  }
}

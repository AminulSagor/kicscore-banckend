import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { NewsArticle } from '../entities/news-article.entity';

const CLEANUP_BATCH_SIZE = 500;
const PROTECTED_NEWS_SOURCE = 'kicscore.com';

export interface NewsRetentionResult {
  deletedArticles: number;
  protectedSource: string;
}

interface IdRow {
  id: string;
}

@Injectable()
export class NewsRetentionService {
  constructor(
    @InjectRepository(NewsArticle)
    private readonly newsArticleRepository: Repository<NewsArticle>,
  ) {}

  async deleteExternalArticlesBefore(
    cutoffDate: Date,
  ): Promise<NewsRetentionResult> {
    let deletedArticles = 0;

    while (true) {
      const rows = await this.newsArticleRepository
        .createQueryBuilder('article')
        .leftJoin('article.source', 'source')
        .select('article.id', 'id')
        .where('article.publishedAt < :cutoffDate', { cutoffDate })
        .andWhere(
          '(source.sourceName IS NULL OR LOWER(TRIM(source.sourceName)) <> :protectedSource)',
          {
            protectedSource: PROTECTED_NEWS_SOURCE,
          },
        )
        .orderBy('article.publishedAt', 'ASC')
        .take(CLEANUP_BATCH_SIZE)
        .getRawMany<IdRow>();

      const articleIds = rows.map((row) => row.id);

      if (!articleIds.length) {
        break;
      }

      const result = await this.newsArticleRepository.delete({
        id: In(articleIds),
      });

      deletedArticles += result.affected ?? 0;

      if (articleIds.length < CLEANUP_BATCH_SIZE) {
        break;
      }
    }

    return {
      deletedArticles,
      protectedSource: PROTECTED_NEWS_SOURCE,
    };
  }
}

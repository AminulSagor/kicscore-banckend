import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TheNewsClient } from './clients/the-news.client';
import { TheNewsController } from './controllers/the-news.controller';
import { NewsArticle } from './entities/news-article.entity';
import { TheNewsCronService } from './services/the-news-cron.service';
import { NewsEntityMapperService } from './services/news-entity-mapper.service';
import { TheNewsService } from './services/the-news.service';
import { NewsArticleContent } from './entities/news-article-content.entity';
import { NewsArticleSource } from './entities/news-article-source.entity';
import { NewsArticleCategory } from './entities/news-article-category.entity';
import { NewsArticleMappedEntity } from './entities/news-article-mapped-entity.entity';
import { NewsArticlePayloadItem } from './entities/news-article-payload-item.entity';
import { NewsNotificationSnapshot } from './entities/news-notification-snapshot.entity';
import { NewsNotificationWorkerState } from './entities/news-notification-worker-state.entity';
import { FollowsModule } from 'src/modules/follows/follows.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { NewsNotificationWorker } from './services/news-notification.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NewsArticle,
      NewsArticleContent,
      NewsArticleSource,
      NewsArticleCategory,
      NewsArticleMappedEntity,
      NewsArticlePayloadItem,
      NewsNotificationSnapshot,
      NewsNotificationWorkerState,
    ]),
    FollowsModule,
    NotificationsModule,
  ],
  controllers: [TheNewsController],
  providers: [
    TheNewsClient,
    NewsEntityMapperService,
    TheNewsService,
    TheNewsCronService,
    NewsNotificationWorker,
  ],
  exports: [TheNewsService],
})
export class TheNewsModule {}

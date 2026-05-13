import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TheNewsClient } from './clients/the-news.client';
import { TheNewsController } from './controllers/the-news.controller';
import { NewsArticle } from './entities/news-article.entity';
import { TheNewsCronService } from './services/the-news-cron.service';
import { NewsEntityMapperService } from './services/news-entity-mapper.service';
import { TheNewsService } from './services/the-news.service';

@Module({
  imports: [TypeOrmModule.forFeature([NewsArticle])],
  controllers: [TheNewsController],
  providers: [
    TheNewsClient,
    NewsEntityMapperService,
    TheNewsService,
    TheNewsCronService,
  ],
  exports: [TheNewsService],
})
export class TheNewsModule {}

import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { ControllerResponse } from '../../common/interfaces/api-response.interface';
import { ListSportsNewsQueryDto } from '../dto/list-sports-news-query.dto';
import { NewsFeedQueryDto } from '../dto/news-feed-query.dto';
import { NewsSimilarQueryDto } from '../dto/news-similar-query.dto';
import { TheNewsService } from '../services/the-news.service';
import {
  NewsArticleResponse,
  PaginatedNewsArticleResponse,
  SimilarNewsResponse,
  mapNewsArticleResponse,
} from '../types/news-article-response.type';
import { FilesService } from 'src/modules/files/files.service';

@Controller('news')
export class TheNewsController {
  constructor(
    private readonly theNewsService: TheNewsService,
    private readonly filesService: FilesService,
  ) {}

  @Public()
  @Get()
  async getNewsFeed(
    @Query() query: NewsFeedQueryDto,
  ): Promise<ControllerResponse<PaginatedNewsArticleResponse>> {
    const data = await this.theNewsService.getNewsFeed(query);

    return {
      message: 'News feed fetched successfully',
      data,
    };
  }

  @Public()
  @Get('sports')
  async getSportsNews(
    @Query() query: ListSportsNewsQueryDto,
  ): Promise<ControllerResponse<PaginatedNewsArticleResponse>> {
    const data = await this.theNewsService.getSportsNews(query);

    return {
      message: 'Sports news fetched successfully',
      data,
    };
  }

  @Public()
  @Get(':uuid/similar')
  async getSimilarNews(
    @Param('uuid') uuid: string,
    @Query() query: NewsSimilarQueryDto,
  ): Promise<ControllerResponse<SimilarNewsResponse>> {
    const data = await this.theNewsService.getSimilarArticles(uuid, query);

    return {
      message: 'Similar news fetched successfully',
      data,
    };
  }

  @Public()
  @Get(':uuid')
  async getNewsByUuid(
    @Param('uuid') uuid: string,
  ): Promise<ControllerResponse<NewsArticleResponse>> {
    const article = await this.theNewsService.getArticleByUuid(uuid);

    const mappedData = await mapNewsArticleResponse(article, this.filesService);

    return {
      message: 'News article fetched successfully',
      data: mappedData,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FollowsService } from 'src/modules/follows/follows.service';
import { NotificationPriority } from 'src/notifications/enums/notification-priority.enum';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NewsArticleMappedEntity } from '../entities/news-article-mapped-entity.entity';
import { NewsArticle } from '../entities/news-article.entity';
import { NewsNotificationSnapshot } from '../entities/news-notification-snapshot.entity';
import { NewsNotificationWorkerState } from '../entities/news-notification-worker-state.entity';
import { NewsEntityType } from '../types/news-entity-mapping.type';

const NEWS_WORKER_STATE_KEY = 'sports-news-notification-worker';

const getCronExpression = (key: string, fallback: string): string => {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : fallback;
};

const newsNotificationCron = getCronExpression(
  'THENEWS_NOTIFICATION_CRON',
  CronExpression.EVERY_HOUR,
);

@Injectable()
export class NewsNotificationWorker {
  private readonly logger = new Logger(NewsNotificationWorker.name);

  constructor(
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,

    @InjectRepository(NewsArticle)
    private readonly newsArticleRepository: Repository<NewsArticle>,

    @InjectRepository(NewsNotificationSnapshot)
    private readonly newsNotificationSnapshotRepository: Repository<NewsNotificationSnapshot>,

    @InjectRepository(NewsNotificationWorkerState)
    private readonly newsNotificationWorkerStateRepository: Repository<NewsNotificationWorkerState>,
  ) {}

  @Cron(newsNotificationCron)
  async handleNewsNotifications(): Promise<void> {
    const enabled = process.env.THENEWS_NOTIFICATION_WORKER_ENABLED === 'true';

    if (!enabled) {
      return;
    }

    await this.processPendingNewsNotifications();
  }

  async processPendingNewsNotifications(): Promise<void> {
    const state = await this.getOrCreateState();

    const limit = Number(process.env.THENEWS_NOTIFICATION_LIMIT ?? 50);

    const articles = await this.newsArticleRepository.find({
      where: {},
      relations: {
        content: true,
        source: true,
        categories: true,
        mappedEntities: true,
      },
      order: {
        publishedAt: 'DESC',
      },
      take: limit,
    });

    let processedCount = 0;
    let notifiedCount = 0;

    for (const article of articles) {
      const existingSnapshot =
        await this.newsNotificationSnapshotRepository.findOne({
          where: {
            articleId: article.id,
          },
        });

      if (existingSnapshot) {
        continue;
      }

      if (!state.initialScanCompleted) {
        await this.newsNotificationSnapshotRepository.save(
          this.newsNotificationSnapshotRepository.create({
            articleId: article.id,
            notifiedAt: new Date(),
            skippedInitial: true,
          }),
        );

        processedCount += 1;
        continue;
      }

      const notifyResult = await this.notifyFollowersForArticle(article);

      await this.newsNotificationSnapshotRepository.save(
        this.newsNotificationSnapshotRepository.create({
          articleId: article.id,
          notifiedAt: notifyResult.notified ? new Date() : null,
          skippedInitial: false,
        }),
      );

      processedCount += 1;

      if (notifyResult.notified) {
        notifiedCount += 1;
      }
    }

    state.initialScanCompleted = true;
    state.lastCheckedAt = new Date();

    await this.newsNotificationWorkerStateRepository.save(state);

    this.logger.log(
      `News notification worker completed. Processed: ${processedCount}, Notified: ${notifiedCount}`,
    );
  }

  private async notifyFollowersForArticle(article: NewsArticle): Promise<{
    notified: boolean;
  }> {
    const mappedEntities = article.mappedEntities ?? [];

    if (!mappedEntities.length) {
      return {
        notified: false,
      };
    }

    const follows = await this.followsService.findActiveFollowsByEntityTypes([
      FollowEntityType.TEAM,
      FollowEntityType.PLAYER,
      FollowEntityType.LEAGUE,
    ]);

    const ownerMap = new Map<
      string,
      {
        userId: string | null;
        installationId: string | null;
      }
    >();

    const matchedTargets: Array<{
      entityType: FollowEntityType;
      entityId: string;
    }> = [];

    for (const follow of follows) {
      const followName = follow.entitySnapshot?.entityName;

      if (!followName) {
        continue;
      }

      const matched = mappedEntities.some((mappedEntity) =>
        this.isFollowMatchedWithNewsEntity({
          followType: follow.entityType,
          followName,
          metadataItems: follow.metadataItems,
          mappedEntity,
        }),
      );

      if (!matched) {
        continue;
      }

      matchedTargets.push({
        entityType: follow.entityType,
        entityId: follow.entityId,
      });

      if (follow.userId) {
        ownerMap.set(`user:${follow.userId}`, {
          userId: follow.userId,
          installationId: null,
        });
      }

      if (follow.installationId) {
        ownerMap.set(`installation:${follow.installationId}`, {
          userId: null,
          installationId: follow.installationId,
        });
      }
    }

    if (!ownerMap.size) {
      return {
        notified: false,
      };
    }

    const primaryTarget = matchedTargets[0];
    const title = `News: ${article.title}`;
    const body =
      article.content?.snippet ??
      article.content?.description ??
      'New football news is available';
    const deepLink = `/news/${article.externalUuid}`;

    const event = await this.notificationsService.createEvent({
      eventType: NotificationType.NEWS,
      entityType: primaryTarget?.entityType ?? null,
      entityId: primaryTarget?.entityId ?? null,
      title,
      body,
      deepLink,
      priority: NotificationPriority.LOW,
      dedupeKey: `news:${article.externalUuid}`,
      data: {
        type: 'NEWS',
        articleId: article.id,
        uuid: article.externalUuid,
        source: article.source?.sourceName ?? null,
        publishedAt: article.publishedAt.toISOString(),
      },
    });

    for (const owner of ownerMap.values()) {
      await this.notificationsService.sendEventToOwner({
        userId: owner.userId,
        installationId: owner.installationId,
        notificationEvent: event,
        title,
        body,
        deepLink,
        data: {
          type: 'NEWS',
          articleId: article.id,
          uuid: article.externalUuid,
        },
      });
    }

    return {
      notified: true,
    };
  }

  private isFollowMatchedWithNewsEntity(params: {
    followType: FollowEntityType;
    followName: string;
    metadataItems?: Array<{
      key: string;
      value: string;
    }>;
    mappedEntity: NewsArticleMappedEntity;
  }): boolean {
    const expectedFollowType = this.mapNewsEntityTypeToFollowEntityType(
      params.mappedEntity.entityType,
    );

    if (params.followType !== expectedFollowType) {
      return false;
    }

    const followName = this.normalizeName(params.followName);
    const mappedName = this.normalizeName(params.mappedEntity.name);
    const matchedText = this.normalizeName(params.mappedEntity.matchedText);

    if (followName === mappedName || followName === matchedText) {
      return true;
    }

    if (
      mappedName.length > 3 &&
      (followName.includes(mappedName) || mappedName.includes(followName))
    ) {
      return true;
    }

    const aliases = params.metadataItems
      ?.filter((item) => ['alias', 'aliases', 'shortName'].includes(item.key))
      .flatMap((item) => item.value.split(','))
      .map((value) => this.normalizeName(value.trim()))
      .filter(Boolean);

    return (
      aliases?.some((alias) => {
        return alias === mappedName || alias === matchedText;
      }) ?? false
    );
  }

  private mapNewsEntityTypeToFollowEntityType(
    entityType: NewsEntityType,
  ): FollowEntityType {
    if (entityType === 'team') {
      return FollowEntityType.TEAM;
    }

    if (entityType === 'player') {
      return FollowEntityType.PLAYER;
    }

    return FollowEntityType.LEAGUE;
  }

  private normalizeName(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getOrCreateState(): Promise<NewsNotificationWorkerState> {
    const existingState =
      await this.newsNotificationWorkerStateRepository.findOne({
        where: {
          stateKey: NEWS_WORKER_STATE_KEY,
        },
      });

    if (existingState) {
      return existingState;
    }

    return this.newsNotificationWorkerStateRepository.save(
      this.newsNotificationWorkerStateRepository.create({
        stateKey: NEWS_WORKER_STATE_KEY,
        initialScanCompleted: false,
        lastCheckedAt: null,
      }),
    );
  }
}

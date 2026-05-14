import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TheNewsService } from './the-news.service';
import { NewsNotificationWorker } from './news-notification.worker';

const getCronExpression = (key: string, fallback: string): string => {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : fallback;
};

const syncCronExpression = getCronExpression(
  'THENEWS_SYNC_CRON',
  CronExpression.EVERY_HOUR,
);

const cleanupCronExpression = getCronExpression(
  'THENEWS_CLEANUP_CRON',
  CronExpression.EVERY_DAY_AT_3AM,
);

@Injectable()
export class TheNewsCronService implements OnModuleInit {
  private readonly logger = new Logger(TheNewsCronService.name);

  constructor(
    private readonly theNewsService: TheNewsService,
    private readonly newsNotificationWorker: NewsNotificationWorker,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.handleSportsNewsSync();
  }

  @Cron(syncCronExpression)
  async handleSportsNewsSync(): Promise<void> {
    try {
      const result = await this.theNewsService.syncSportsNews();

      this.logger.log(
        `Sports news sync completed. Fetched: ${result.fetched}, Saved: ${result.saved}`,
      );

      if (process.env.THENEWS_NOTIFICATION_WORKER_ENABLED === 'true') {
        await this.newsNotificationWorker.processPendingNewsNotifications();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Sports news sync failed: ${message}`);
    }
  }

  @Cron(cleanupCronExpression)
  async handleOldNewsCleanup(): Promise<void> {
    try {
      const result =
        await this.theNewsService.deleteArticlesOlderThanThirtyDays();

      this.logger.log(
        `Old news cleanup completed. Deleted: ${result.deleted}, Cutoff: ${result.cutoffDate.toISOString()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Old news cleanup failed: ${message}`);
    }
  }
}

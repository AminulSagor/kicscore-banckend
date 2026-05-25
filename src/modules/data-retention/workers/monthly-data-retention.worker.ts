import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationRetentionService } from 'src/notifications/notification-retention.service';
import { NewsRetentionService } from 'src/the-news/services/news-retention.service';

const getStringEnv = (key: string, fallback: string): string => {
  const value = process.env[key]?.trim();

  return value?.length ? value : fallback;
};

const monthlyRetentionCronExpression = getStringEnv(
  'DATA_RETENTION_CRON',
  '0 0 3 1 * *',
);

const dataRetentionTimeZone = getStringEnv('DATA_RETENTION_TIME_ZONE', 'UTC');

@Injectable()
export class MonthlyDataRetentionWorker {
  private readonly logger = new Logger(MonthlyDataRetentionWorker.name);

  constructor(
    private readonly notificationRetentionService: NotificationRetentionService,
    private readonly newsRetentionService: NewsRetentionService,
  ) {}

  @Cron(monthlyRetentionCronExpression, {
    timeZone: dataRetentionTimeZone,
  })
  async handleMonthlyCleanup(): Promise<void> {
    const cutoffDate = this.getPreviousMonthStartUtc();

    try {
      const notificationResult =
        await this.notificationRetentionService.deleteNotificationHistoryBefore(
          cutoffDate,
        );

      const newsResult =
        await this.newsRetentionService.deleteExternalArticlesBefore(
          cutoffDate,
        );

      this.logger.log(
        `Monthly data retention completed. Cutoff: ${cutoffDate.toISOString()}, Notifications deleted: ${notificationResult.deletedNotifications}, Notification events deleted: ${notificationResult.deletedOrphanEvents}, News articles deleted: ${newsResult.deletedArticles}, Protected news source: ${newsResult.protectedSource}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const trace = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Monthly data retention failed: ${message}`, trace);
    }
  }

  private getPreviousMonthStartUtc(referenceDate: Date = new Date()): Date {
    return new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth() - 1,
        1,
      ),
    );
  }
}

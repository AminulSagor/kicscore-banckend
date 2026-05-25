import { Module } from '@nestjs/common';

import { NotificationsModule } from 'src/notifications/notifications.module';
import { TheNewsModule } from 'src/the-news/the-news.module';
import { MonthlyDataRetentionWorker } from './workers/monthly-data-retention.worker';

@Module({
  imports: [NotificationsModule, TheNewsModule],
  providers: [MonthlyDataRetentionWorker],
})
export class DataRetentionModule {}

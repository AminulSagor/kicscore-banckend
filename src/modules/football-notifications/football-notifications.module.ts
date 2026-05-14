import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiFootballModule } from 'src/api-football/api-football.module';
import { RedisModule } from 'src/redis/redis.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { FollowsModule } from '../follows/follows.module';
import { FootballFixtureNotificationSnapshot } from './entities/football-fixture-notification-snapshot.entity';
import { FootballNotificationFanoutService } from './football-notification-fanout.service';
import { LiveFixtureNotificationWorker } from './workers/live-fixture-notification.worker';

@Module({
  imports: [
    ApiFootballModule,
    RedisModule,
    NotificationsModule,
    FollowsModule,
    TypeOrmModule.forFeature([FootballFixtureNotificationSnapshot]),
  ],
  providers: [FootballNotificationFanoutService, LiveFixtureNotificationWorker],
  exports: [FootballNotificationFanoutService],
})
export class FootballNotificationsModule {}

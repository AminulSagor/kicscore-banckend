import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiFootballModule } from 'src/api-football/api-football.module';
import { RedisModule } from 'src/redis/redis.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { FollowsModule } from '../follows/follows.module';
import { FootballFixtureNotificationSnapshot } from './entities/football-fixture-notification-snapshot.entity';
import { FootballNotificationFanoutService } from './football-notification-fanout.service';
import { GoalNotificationWorker } from './workers/goal-notification.worker';

@Module({
  imports: [
    ApiFootballModule,
    RedisModule,
    NotificationsModule,
    FollowsModule,
    TypeOrmModule.forFeature([FootballFixtureNotificationSnapshot]),
  ],
  providers: [FootballNotificationFanoutService, GoalNotificationWorker],
  exports: [FootballNotificationFanoutService],
})
export class FootballNotificationsModule {}

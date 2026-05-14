import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiFootballModule } from 'src/api-football/api-football.module';
import { RedisModule } from 'src/redis/redis.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { FollowsModule } from '../follows/follows.module';
import { FootballFixtureNotificationSnapshot } from './entities/football-fixture-notification-snapshot.entity';
import { FootballNotificationFanoutService } from './football-notification-fanout.service';
import { LiveFixtureNotificationWorker } from './workers/live-fixture-notification.worker';
import { FootballLineupNotificationSnapshot } from './entities/football-lineup-notification-snapshot.entity';
import { StartingXiNotificationWorker } from './workers/starting-xi-notification.worker';
import { FootballFixtureEventNotificationSnapshot } from './entities/football-fixture-event-notification-snapshot.entity';
import { FootballTransferNotificationSnapshot } from './entities/football-transfer-notification-snapshot.entity';
import { FootballTransferTargetScan } from './entities/football-transfer-target-scan.entity';
import { TransferNotificationWorker } from './workers/transfer-notification.worker';
import { InjuryNotificationWorker } from './workers/injury-notification.worker';
import { FootballInjuryNotificationSnapshot } from './entities/football-injury-notification-snapshot.entity';
import { FootballInjuryTargetScan } from './entities/football-injury-target-scan.entity';
import { FootballStandingsTargetScan } from './entities/football-standings-target-scan.entity';
import { FootballStandingsTeamSnapshot } from './entities/football-standings-team-snapshot.entity';
import { TableChangeNotificationWorker } from './workers/table-change-notification.worker';

@Module({
  imports: [
    ApiFootballModule,
    RedisModule,
    NotificationsModule,
    FollowsModule,
    TypeOrmModule.forFeature([
      FootballFixtureNotificationSnapshot,
      FootballLineupNotificationSnapshot,
      FootballFixtureEventNotificationSnapshot,
      FootballTransferNotificationSnapshot,
      FootballTransferTargetScan,
      FootballInjuryNotificationSnapshot,
      FootballInjuryTargetScan,
      FootballStandingsTargetScan,
      FootballStandingsTeamSnapshot,
    ]),
  ],
  providers: [
    FootballNotificationFanoutService,
    LiveFixtureNotificationWorker,
    StartingXiNotificationWorker,
    TransferNotificationWorker,
    InjuryNotificationWorker,
    TableChangeNotificationWorker,
  ],
  exports: [FootballNotificationFanoutService],
})
export class FootballNotificationsModule {}

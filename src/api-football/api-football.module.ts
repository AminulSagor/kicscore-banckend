import { Module } from '@nestjs/common';
import { ApiFootballClient } from './api-football.client';
import { ApiFootballCacheService } from './api-football-cache.service';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';
import { FootballCompositeService } from './football-composite.service';
import { FollowsModule } from 'src/modules/follows/follows.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamTrophyPreviewGroup } from './entities/team-trophy-preview-group.entity';
import { TeamTrophyPreviewSeason } from './entities/team-trophy-preview-season.entity';
import { TeamTrophyPreviewWorker } from './workers/team-trophy-preview.worker';
import { TeamTrophyPreviewTarget } from './entities/team-trophy-preview-target.entity';
import { PlayerCareerSyncState } from './entities/player-career-sync-state.entity';
import { PlayerCareerSeasonStat } from './entities/player-career-season-stat.entity';
import { PlayerCareerTransferSnapshot } from './entities/player-career-transfer-snapshot.entity';
import { PlayerCareerService } from './player-career.service';
import { PlayerCareerCacheWorker } from './workers/player-career-cache.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeamTrophyPreviewTarget,
      TeamTrophyPreviewGroup,
      TeamTrophyPreviewSeason,
      PlayerCareerSyncState,
      PlayerCareerSeasonStat,
      PlayerCareerTransferSnapshot,
    ]),
    FollowsModule,
  ],
  controllers: [FootballController],
  providers: [
    ApiFootballClient,
    ApiFootballCacheService,
    FootballService,
    FootballCompositeService,
    PlayerCareerService,
    TeamTrophyPreviewWorker,
    PlayerCareerCacheWorker,
  ],
  exports: [
    FootballService,
    ApiFootballCacheService,
    FootballCompositeService,
    PlayerCareerService,
  ],
})
export class ApiFootballModule {}

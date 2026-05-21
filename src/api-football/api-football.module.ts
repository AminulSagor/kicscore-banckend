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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeamTrophyPreviewTarget,
      TeamTrophyPreviewGroup,
      TeamTrophyPreviewSeason,
    ]),
    FollowsModule,
  ],
  controllers: [FootballController],
  providers: [
    ApiFootballClient,
    ApiFootballCacheService,
    FootballService,
    FootballCompositeService,
    TeamTrophyPreviewWorker,
  ],
  exports: [FootballService, ApiFootballCacheService, FootballCompositeService],
})
export class ApiFootballModule {}

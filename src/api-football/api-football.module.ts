import { Module } from '@nestjs/common';
import { ApiFootballClient } from './api-football.client';
import { ApiFootballCacheService } from './api-football-cache.service';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';
import { FootballCompositeService } from './football-composite.service';
import { FollowsModule } from 'src/modules/follows/follows.module';

@Module({
  imports: [FollowsModule],
  controllers: [FootballController],
  providers: [
    ApiFootballClient,
    ApiFootballCacheService,
    FootballService,
    FootballCompositeService,
  ],
  exports: [FootballService, ApiFootballCacheService, FootballCompositeService],
})
export class ApiFootballModule {}

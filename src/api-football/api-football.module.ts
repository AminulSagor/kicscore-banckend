import { Module } from '@nestjs/common';
import { ApiFootballClient } from './api-football.client';
import { ApiFootballCacheService } from './api-football-cache.service';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';

@Module({
  controllers: [FootballController],
  providers: [ApiFootballClient, ApiFootballCacheService, FootballService],
  exports: [FootballService, ApiFootballCacheService],
})
export class ApiFootballModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiFootballModule } from 'src/api-football/api-football.module';
import { RedisModule } from 'src/redis/redis.module';
import { FootballTournamentSeasonsController } from './football-tournament-seasons.controller';
import { FootballTournamentSeason } from './entities/football-tournament-season.entity';
import { FootballTournamentSeasonsService } from './football-tournament-seasons.service';
import { WorldCupHistorySeederService } from './world-cup-history-seeder.service';
import { WorldCupSeasonSyncWorker } from './workers/world-cup-season-sync.worker';

@Module({
  imports: [
    ApiFootballModule,
    RedisModule,
    TypeOrmModule.forFeature([FootballTournamentSeason]),
  ],
  controllers: [FootballTournamentSeasonsController],
  providers: [
    FootballTournamentSeasonsService,
    WorldCupHistorySeederService,
    WorldCupSeasonSyncWorker,
  ],
  exports: [FootballTournamentSeasonsService],
})
export class FootballHistoryModule {}

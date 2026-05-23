import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';

import { FootballTournamentSeason } from './entities/football-tournament-season.entity';
import { FootballTournamentSeasonSource } from './enums/football-tournament-season-source.enum';
import { FootballTournamentSeasonStatus } from './enums/football-tournament-season-status.enum';

interface WorldCupHistorySeedRow {
  leagueId: string;
  leagueName: string;
  season: number;
  winnerName: string;
  winnerLogo: string | null;
  runnerUpName: string;
  runnerUpLogo: string | null;
}

@Injectable()
export class WorldCupHistorySeederService {
  private readonly logger = new Logger(WorldCupHistorySeederService.name);

  constructor(
    @InjectRepository(FootballTournamentSeason)
    private readonly tournamentSeasonRepository: Repository<FootballTournamentSeason>,
  ) {}

  async seedHistoricalSeasons(): Promise<number> {
    const seedRows = await this.readSeedRows();

    const existingItems = await this.tournamentSeasonRepository.find({
      where: seedRows.map((item) => ({
        leagueId: item.leagueId,
        season: item.season,
      })),
    });

    const existingSeasonSet = new Set(
      existingItems.map((item) => `${item.leagueId}:${item.season}`),
    );

    const newItems = seedRows
      .filter(
        (item) => !existingSeasonSet.has(`${item.leagueId}:${item.season}`),
      )
      .map((item) =>
        this.tournamentSeasonRepository.create({
          leagueId: item.leagueId,
          leagueName: item.leagueName,
          season: item.season,
          winnerTeamId: null,
          winnerName: item.winnerName,
          winnerLogo: item.winnerLogo,
          runnerUpTeamId: null,
          runnerUpName: item.runnerUpName,
          runnerUpLogo: item.runnerUpLogo,
          finalFixtureId: null,
          source: FootballTournamentSeasonSource.SEED,
          status: FootballTournamentSeasonStatus.COMPLETED,
          apiSyncedAt: null,
        }),
      );

    if (!newItems.length) {
      return 0;
    }

    await this.tournamentSeasonRepository.save(newItems);

    this.logger.log(`Seeded ${newItems.length} historic World Cup seasons`);

    return newItems.length;
  }

  private async readSeedRows(): Promise<WorldCupHistorySeedRow[]> {
    const csvPath = join(__dirname, 'seeds/world-cup-history.1930-2006.csv');

    const csvContent = await readFile(csvPath, 'utf8');
    const [, ...dataRows] = csvContent.trim().split(/\r?\n/);

    return dataRows.map((row) => {
      const [
        leagueId,
        leagueName,
        season,
        winnerName,
        winnerLogo,
        runnerUpName,
        runnerUpLogo,
      ] = row.split(',').map((value) => value.trim());

      return {
        leagueId,
        leagueName,
        season: Number(season),
        winnerName,
        winnerLogo: winnerLogo || null,
        runnerUpName,
        runnerUpLogo: runnerUpLogo || null,
      };
    });
  }
}

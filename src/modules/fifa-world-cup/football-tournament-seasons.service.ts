import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FootballService } from 'src/api-football/football.service';
import {
  ApiFootballFixture,
  ApiFootballFixturesResponse,
} from 'src/common/interfaces/api-football-custom-response.interface';
import { FootballTournamentSeason } from './entities/football-tournament-season.entity';
import { FootballTournamentSeasonSource } from './enums/football-tournament-season-source.enum';
import { FootballTournamentSeasonStatus } from './enums/football-tournament-season-status.enum';
import {
  FootballTournamentSeasonHistoryResponse,
  mapFootballTournamentSeasonResponse,
} from './types/football-tournament-season-response.type';

const WORLD_CUP_LEAGUE_ID = '1';
const WORLD_CUP_LEAGUE_NAME = 'World Cup';

const API_SUPPORTED_COMPLETED_SEASONS = [2010, 2014, 2018, 2022] as const;

const COMPLETED_FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'PSO']);

const CURRENT_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

const FIRST_AUTOMATED_WORLD_CUP_SEASON = 2026;
const WORLD_CUP_INTERVAL_YEARS = 4;

@Injectable()
export class FootballTournamentSeasonsService {
  constructor(
    @InjectRepository(FootballTournamentSeason)
    private readonly tournamentSeasonRepository: Repository<FootballTournamentSeason>,
    private readonly footballService: FootballService,
  ) {}

  async getWorldCupHistory(): Promise<FootballTournamentSeasonHistoryResponse> {
    const seasons = await this.tournamentSeasonRepository.find({
      where: {
        leagueId: WORLD_CUP_LEAGUE_ID,
      },
      order: {
        season: 'DESC',
      },
    });

    return {
      league: {
        id: WORLD_CUP_LEAGUE_ID,
        name: WORLD_CUP_LEAGUE_NAME,
      },
      seasons: seasons.map(mapFootballTournamentSeasonResponse),
    };
  }

  async syncMissingApiSupportedSeasons(): Promise<number> {
    let syncedCount = 0;

    for (const season of API_SUPPORTED_COMPLETED_SEASONS) {
      const existingSeason = await this.findWorldCupSeason(season);

      if (existingSeason?.status === FootballTournamentSeasonStatus.COMPLETED) {
        continue;
      }

      await this.syncSeasonFromApi(season);
      syncedCount += 1;
    }

    return syncedCount;
  }

  async syncCurrentSeasonIfDue(): Promise<boolean> {
    const currentSeason = this.getCurrentWorldCupSeason();
    const existingSeason = await this.findWorldCupSeason(currentSeason);

    if (existingSeason?.status === FootballTournamentSeasonStatus.COMPLETED) {
      return false;
    }

    if (this.wasSyncedWithinOneDay(existingSeason?.apiSyncedAt ?? null)) {
      return false;
    }

    await this.syncSeasonFromApi(currentSeason);

    return true;
  }

  private async syncSeasonFromApi(season: number): Promise<void> {
    const data = (await this.footballService.getWorldCupFinalFixture(
      String(season),
    )) as ApiFootballFixturesResponse;

    const finalFixture = data.response?.[0] ?? null;

    const completedTeams = finalFixture
      ? this.resolveFinalTeams(finalFixture)
      : null;

    const existingSeason = await this.findWorldCupSeason(season);

    const item = this.tournamentSeasonRepository.create({
      ...existingSeason,
      leagueId: WORLD_CUP_LEAGUE_ID,
      leagueName: WORLD_CUP_LEAGUE_NAME,
      season,
      winnerTeamId: completedTeams?.winner.id
        ? String(completedTeams.winner.id)
        : null,
      winnerName: completedTeams?.winner.name ?? null,
      winnerLogo: completedTeams?.winner.logo ?? null,
      runnerUpTeamId: completedTeams?.runnerUp.id
        ? String(completedTeams.runnerUp.id)
        : null,
      runnerUpName: completedTeams?.runnerUp.name ?? null,
      runnerUpLogo: completedTeams?.runnerUp.logo ?? null,
      finalFixtureId: finalFixture?.fixture.id
        ? String(finalFixture.fixture.id)
        : null,
      source: FootballTournamentSeasonSource.API_FOOTBALL,
      status: completedTeams
        ? FootballTournamentSeasonStatus.COMPLETED
        : FootballTournamentSeasonStatus.PENDING,
      apiSyncedAt: new Date(),
    });

    await this.tournamentSeasonRepository.save(item);
  }

  private resolveFinalTeams(fixture: ApiFootballFixture): {
    winner: ApiFootballFixture['teams']['home'];
    runnerUp: ApiFootballFixture['teams']['away'];
  } | null {
    const status = fixture.fixture.status.short;

    if (!COMPLETED_FINAL_STATUSES.has(status)) {
      return null;
    }

    if (fixture.teams.home.winner === true) {
      return {
        winner: fixture.teams.home,
        runnerUp: fixture.teams.away,
      };
    }

    if (fixture.teams.away.winner === true) {
      return {
        winner: fixture.teams.away,
        runnerUp: fixture.teams.home,
      };
    }

    return null;
  }

  private findWorldCupSeason(
    season: number,
  ): Promise<FootballTournamentSeason | null> {
    return this.tournamentSeasonRepository.findOne({
      where: {
        leagueId: WORLD_CUP_LEAGUE_ID,
        season,
      },
    });
  }

  private wasSyncedWithinOneDay(apiSyncedAt: Date | null): boolean {
    if (!apiSyncedAt) {
      return false;
    }

    return Date.now() - apiSyncedAt.getTime() < CURRENT_SYNC_TTL_MS;
  }

  private getCurrentWorldCupSeason(referenceDate: Date = new Date()): number {
    const currentYear = referenceDate.getUTCFullYear();

    if (currentYear <= FIRST_AUTOMATED_WORLD_CUP_SEASON) {
      return FIRST_AUTOMATED_WORLD_CUP_SEASON;
    }

    const completedCycles = Math.floor(
      (currentYear - FIRST_AUTOMATED_WORLD_CUP_SEASON) /
        WORLD_CUP_INTERVAL_YEARS,
    );

    return (
      FIRST_AUTOMATED_WORLD_CUP_SEASON +
      completedCycles * WORLD_CUP_INTERVAL_YEARS
    );
  }
}

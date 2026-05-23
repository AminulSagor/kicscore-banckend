import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { MoreThan, Repository } from 'typeorm';

import { FootballCompositeQueryDto } from './dto/football-composite-query.dto';
import { PlayerCareerSeasonStat } from './entities/player-career-season-stat.entity';
import { PlayerCareerTeamType } from './entities/player-career-season-stat.entity';
import { PlayerCareerSyncState } from './entities/player-career-sync-state.entity';
import { PlayerCareerTransferSnapshot } from './entities/player-career-transfer-snapshot.entity';
import { FootballService } from './football.service';
import {
  PlayerCareerApiWrapped,
  PlayerCareerGamesStatistics,
  PlayerCareerSeasonStatInput,
  PlayerCareerStatisticsApiItem,
  PlayerCareerTeamCard,
  PlayerCareerTransferApiItem,
  PlayerCareerTransferInput,
  PlayerCareerTransferItem,
} from './types/player-career.type';
import { ConfigService } from '@nestjs/config';

type TeamSeasonAccumulator = {
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  appearances: number;
  goals: number;
  leagueNames: Set<string>;
  nationality: string | null;
};

type CareerCardAccumulator = {
  team: {
    id: string;
    name: string;
    logo: string | null;
  };
  teamType: PlayerCareerTeamType;
  fromSeason: number;
  toSeason: number;
  isCurrent: boolean;
  matchesPlayed: number;
  goals: number;
};

@Injectable()
export class PlayerCareerService {
  constructor(
    private readonly footballService: FootballService,
    private readonly configService: ConfigService,

    @InjectRepository(PlayerCareerSyncState)
    private readonly syncStateRepository: Repository<PlayerCareerSyncState>,

    @InjectRepository(PlayerCareerSeasonStat)
    private readonly seasonStatRepository: Repository<PlayerCareerSeasonStat>,

    @InjectRepository(PlayerCareerTransferSnapshot)
    private readonly transferSnapshotRepository: Repository<PlayerCareerTransferSnapshot>,
  ) {}

  async getPlayerCareerTotals(
    playerId: string,
    query: FootballCompositeQueryDto,
  ) {
    const syncState = await this.ensureSyncState(playerId);

    const hasInvalidAppearancesCache =
      syncState.initialSyncCompleted &&
      (await this.hasInvalidAppearancesCache(playerId));

    if (!syncState.initialSyncCompleted || hasInvalidAppearancesCache) {
      await this.runInitialSync(playerId);
    } else if (!this.isCurrentCacheFresh(syncState)) {
      await this.refreshActiveCareerData(playerId, false);
    }

    return this.buildCareerResponse(playerId, query);
  }

  async refreshWeeklyCachedCareer(playerId: string): Promise<void> {
    const syncState = await this.syncStateRepository.findOne({
      where: {
        playerId,
        initialSyncCompleted: true,
      },
    });

    if (!syncState) {
      return;
    }

    await this.refreshActiveCareerData(playerId, true);
  }

  //======= Initial PostgreSQL Cache Build =======//

  private async runInitialSync(playerId: string): Promise<void> {
    const syncState = await this.beginSync(playerId, true);

    const fromSeason = this.getInitialFromSeason();
    const toSeason = this.getCurrentYear();
    const activeSeasons = this.getActiveRefreshSeasons();

    try {
      const transfers = await this.fetchAndReplaceTransfers(playerId, false);
      const rows: PlayerCareerSeasonStatInput[] = [];

      for (let season = fromSeason; season <= toSeason; season += 1) {
        const seasonRows = await this.fetchSeasonStatsRows({
          playerId,
          season,
          transfers,
        });

        rows.push(...seasonRows);
      }

      const preparedRows = this.applyCurrentTeamFlags(
        rows,
        transfers,
        activeSeasons,
      );

      await this.replaceAllSeasonStats(playerId, preparedRows);

      syncState.currentSeason = toSeason;
      syncState.initialSyncCompleted = true;
      syncState.fullSyncFromSeason = fromSeason;
      syncState.fullSyncToSeason = toSeason;
      syncState.currentStatsFreshUntil = this.createFreshUntil();
      syncState.transfersLastSyncedAt = new Date();
      syncState.lastSyncedAt = new Date();
      syncState.syncInProgress = false;
      syncState.syncStartedAt = null;
      syncState.lastError = null;

      await this.syncStateRepository.save(syncState);
    } catch (error) {
      await this.completeSyncWithError(syncState, error);
      throw error;
    }
  }

  //======= Current Club / National Team Refresh =======//

  private async refreshActiveCareerData(
    playerId: string,
    forceTransferRefresh: boolean,
  ): Promise<void> {
    const syncState = await this.beginSync(playerId, false);

    if (!syncState) {
      return;
    }

    const activeSeasons = this.getActiveRefreshSeasons();
    let transfersRefreshed = forceTransferRefresh;

    try {
      let transfers = await this.transferSnapshotRepository.find({
        where: {
          playerId,
        },
        order: {
          transferDate: 'DESC',
        },
      });

      if (forceTransferRefresh) {
        transfers = await this.fetchAndReplaceTransfers(playerId, true);
      }

      let activeRows = await this.fetchRowsForSeasons({
        playerId,
        seasons: activeSeasons,
        transfers,
      });

      const storedCurrentClubId = await this.getStoredCurrentClubId(playerId);
      const detectedCurrentClubId = this.detectCurrentClubId(
        activeRows,
        transfers,
        activeSeasons,
      );

      const currentClubChanged =
        Boolean(detectedCurrentClubId) &&
        detectedCurrentClubId !== storedCurrentClubId;

      if (!forceTransferRefresh && currentClubChanged) {
        transfers = await this.fetchAndReplaceTransfers(playerId, true);
        transfersRefreshed = true;

        activeRows = await this.fetchRowsForSeasons({
          playerId,
          seasons: activeSeasons,
          transfers,
        });
      }

      if (activeRows.length > 0) {
        const preparedRows = this.applyCurrentTeamFlags(
          activeRows,
          transfers,
          activeSeasons,
        );

        await this.replaceActiveSeasonStats(
          playerId,
          activeSeasons,
          preparedRows,
        );
      }

      syncState.currentSeason = this.getCurrentYear();
      syncState.currentStatsFreshUntil = this.createFreshUntil();
      syncState.transfersLastSyncedAt = transfersRefreshed
        ? new Date()
        : syncState.transfersLastSyncedAt;
      syncState.lastSyncedAt = new Date();
      syncState.syncInProgress = false;
      syncState.syncStartedAt = null;
      syncState.lastError = null;

      await this.syncStateRepository.save(syncState);
    } catch (error) {
      await this.completeSyncWithError(syncState, error);
      throw error;
    }
  }

  //======= API-Football Fetch Mapping =======//

  private async fetchRowsForSeasons(params: {
    playerId: string;
    seasons: number[];
    transfers: PlayerCareerTransferSnapshot[];
  }): Promise<PlayerCareerSeasonStatInput[]> {
    const rows: PlayerCareerSeasonStatInput[] = [];

    for (const season of params.seasons) {
      const seasonRows = await this.fetchSeasonStatsRows({
        playerId: params.playerId,
        season,
        transfers: params.transfers,
      });

      rows.push(...seasonRows);
    }

    return rows;
  }

  private async fetchSeasonStatsRows(params: {
    playerId: string;
    season: number;
    transfers: PlayerCareerTransferSnapshot[];
  }): Promise<PlayerCareerSeasonStatInput[]> {
    const response = (await this.footballService.getPlayerCareerSeasonStats(
      params.playerId,
      params.season,
      this.isActiveSeason(params.season),
    )) as PlayerCareerApiWrapped<PlayerCareerStatisticsApiItem>;

    if (this.hasApiErrors(response.errors)) {
      throw new ServiceUnavailableException(
        `Unable to fetch player career statistics for season ${params.season}.`,
      );
    }

    const knownClubIds = this.getKnownClubTeamIds(params.transfers);
    const teamMap = new Map<string, TeamSeasonAccumulator>();

    for (const playerItem of response.response ?? []) {
      const nationality = playerItem.player?.nationality ?? null;

      for (const statistic of playerItem.statistics ?? []) {
        const teamId = statistic.team?.id;

        if (!teamId) {
          continue;
        }

        const key = String(teamId);

        const existing = teamMap.get(key) ?? {
          teamId: key,
          teamName: statistic.team?.name ?? 'Unknown Team',
          teamLogo: statistic.team?.logo ?? null,
          nationality,
          leagueNames: new Set<string>(),
          appearances: 0,
          goals: 0,
        };

        existing.appearances += this.getPlayerAppearances(statistic.games);
        existing.goals += statistic.goals?.total ?? 0;

        if (statistic.league?.name) {
          existing.leagueNames.add(statistic.league.name);
        }

        teamMap.set(key, existing);
      }
    }

    return Array.from(teamMap.values()).map((item) => {
      const teamType = this.resolveTeamType({
        teamId: item.teamId,
        teamName: item.teamName,
        nationality: item.nationality,
        leagueNames: Array.from(item.leagueNames),
        knownClubIds,
      });

      return {
        playerId: params.playerId,
        season: params.season,
        teamId: item.teamId,
        teamName: item.teamName,
        teamLogo: item.teamLogo,
        teamType,
        appearances: item.appearances,
        goals: item.goals,
        isCurrentTeam: false,
      };
    });
  }

  private getPlayerAppearances(games?: PlayerCareerGamesStatistics): number {
    return games?.appearences ?? games?.appearances ?? 0;
  }

  private async hasInvalidAppearancesCache(playerId: string): Promise<boolean> {
    const invalidRowsCount = await this.seasonStatRepository.count({
      where: {
        playerId,
        appearances: 0,
        goals: MoreThan(0),
      },
    });

    return invalidRowsCount > 0;
  }

  private async fetchAndReplaceTransfers(
    playerId: string,
    forceRefresh: boolean,
  ): Promise<PlayerCareerTransferSnapshot[]> {
    const response = (await this.footballService.getPlayerCareerTransfers(
      playerId,
      forceRefresh,
    )) as PlayerCareerApiWrapped<PlayerCareerTransferApiItem>;

    if (this.hasApiErrors(response.errors)) {
      throw new ServiceUnavailableException(
        'Unable to fetch player transfer history.',
      );
    }

    const transferInputs = this.mapTransferInputs(playerId, response);

    if (forceRefresh && transferInputs.length === 0) {
      const existingSnapshots = await this.transferSnapshotRepository.find({
        where: {
          playerId,
        },
        order: {
          transferDate: 'DESC',
        },
      });

      if (existingSnapshots.length > 0) {
        return existingSnapshots;
      }
    }

    await this.transferSnapshotRepository.delete({
      playerId,
    });

    if (transferInputs.length > 0) {
      await this.transferSnapshotRepository.save(
        transferInputs.map((input) => {
          return this.transferSnapshotRepository.create(input);
        }),
      );
    }

    return this.transferSnapshotRepository.find({
      where: {
        playerId,
      },
      order: {
        transferDate: 'DESC',
      },
    });
  }

  private hasApiErrors(errors: unknown): boolean {
    if (Array.isArray(errors)) {
      return errors.length > 0;
    }

    if (typeof errors === 'object' && errors !== null) {
      return Object.keys(errors).length > 0;
    }

    return false;
  }

  private mapTransferInputs(
    playerId: string,
    response: PlayerCareerApiWrapped<PlayerCareerTransferApiItem>,
  ): PlayerCareerTransferInput[] {
    const transferMap = new Map<string, PlayerCareerTransferInput>();

    for (const playerItem of response.response ?? []) {
      for (const transfer of playerItem.transfers ?? []) {
        if (!transfer.date) {
          continue;
        }

        const fromTeamId = transfer.teams?.out?.id
          ? String(transfer.teams.out.id)
          : null;

        const toTeamId = transfer.teams?.in?.id
          ? String(transfer.teams.in.id)
          : null;

        const transferKey = createHash('sha256')
          .update(
            [
              playerId,
              transfer.date,
              transfer.type ?? '',
              fromTeamId ?? '',
              toTeamId ?? '',
            ].join('|'),
          )
          .digest('hex');

        transferMap.set(transferKey, {
          playerId,
          transferKey,
          transferDate: transfer.date,
          transferType: transfer.type ?? null,
          fromTeamId,
          fromTeamName: transfer.teams?.out?.name ?? null,
          fromTeamLogo: transfer.teams?.out?.logo ?? null,
          toTeamId,
          toTeamName: transfer.teams?.in?.name ?? null,
          toTeamLogo: transfer.teams?.in?.logo ?? null,
        });
      }
    }

    return Array.from(transferMap.values());
  }

  //======= Current Team Detection =======//

  private applyCurrentTeamFlags(
    rows: PlayerCareerSeasonStatInput[],
    transfers: PlayerCareerTransferSnapshot[],
    activeSeasons: number[],
  ): PlayerCareerSeasonStatInput[] {
    const activeSeasonSet = new Set(activeSeasons);

    const currentClubId = this.detectCurrentClubId(
      rows,
      transfers,
      activeSeasons,
    );

    const currentNationalTeamId = this.detectCurrentNationalTeamId(
      rows,
      activeSeasons,
    );

    return rows.map((row) => {
      const belongsToActiveSeason = activeSeasonSet.has(row.season);

      const isCurrentClub =
        row.teamType === PlayerCareerTeamType.CLUB &&
        row.teamId === currentClubId;

      const isCurrentNationalTeam =
        row.teamType === PlayerCareerTeamType.NATIONAL_TEAM &&
        row.teamId === currentNationalTeamId;

      return {
        ...row,
        isCurrentTeam:
          belongsToActiveSeason && (isCurrentClub || isCurrentNationalTeam),
      };
    });
  }

  private detectCurrentClubId(
    rows: PlayerCareerSeasonStatInput[],
    transfers: PlayerCareerTransferSnapshot[],
    activeSeasons: number[],
  ): string | null {
    const activeSeasonSet = new Set(activeSeasons);

    const activeClubRows = rows.filter((row) => {
      return (
        activeSeasonSet.has(row.season) &&
        row.teamType === PlayerCareerTeamType.CLUB
      );
    });

    if (!activeClubRows.length) {
      return null;
    }

    const activeClubIds = new Set(activeClubRows.map((row) => row.teamId));

    for (const transfer of transfers) {
      if (transfer.toTeamId && activeClubIds.has(transfer.toTeamId)) {
        return transfer.toTeamId;
      }
    }

    const latestSeason = Math.max(...activeClubRows.map((row) => row.season));

    const latestRows = activeClubRows.filter((row) => {
      return row.season === latestSeason;
    });

    return (
      latestRows.sort((left, right) => {
        return right.appearances - left.appearances;
      })[0]?.teamId ?? null
    );
  }

  private detectCurrentNationalTeamId(
    rows: PlayerCareerSeasonStatInput[],
    activeSeasons: number[],
  ): string | null {
    const activeSeasonSet = new Set(activeSeasons);

    const nationalRows = rows.filter((row) => {
      return (
        activeSeasonSet.has(row.season) &&
        row.teamType === PlayerCareerTeamType.NATIONAL_TEAM
      );
    });

    if (!nationalRows.length) {
      return null;
    }

    return (
      nationalRows.sort((left, right) => {
        if (left.season !== right.season) {
          return right.season - left.season;
        }

        return right.appearances - left.appearances;
      })[0]?.teamId ?? null
    );
  }

  private async getStoredCurrentClubId(
    playerId: string,
  ): Promise<string | null> {
    const row = await this.seasonStatRepository.findOne({
      where: {
        playerId,
        teamType: PlayerCareerTeamType.CLUB,
        isCurrentTeam: true,
      },
      order: {
        season: 'DESC',
      },
    });

    return row?.teamId ?? null;
  }

  private resolveTeamType(params: {
    teamId: string;
    teamName: string;
    nationality: string | null;
    leagueNames: string[];
    knownClubIds: Set<string>;
  }): PlayerCareerTeamType {
    if (params.knownClubIds.has(params.teamId)) {
      return PlayerCareerTeamType.CLUB;
    }

    if (params.nationality) {
      const normalizedTeamName = this.normalizeText(params.teamName);
      const normalizedNationality = this.normalizeText(params.nationality);

      if (
        normalizedTeamName === normalizedNationality ||
        normalizedTeamName.startsWith(normalizedNationality)
      ) {
        return PlayerCareerTeamType.NATIONAL_TEAM;
      }
    }

    const internationalCompetitionWords = [
      'world cup',
      'euro championship',
      'copa america',
      'africa cup of nations',
      'asian cup',
      'uefa nations league',
      'friendlies',
      'qualification',
    ];

    const isInternationalTeam = params.leagueNames.some((leagueName) => {
      const normalizedLeagueName = leagueName.toLowerCase();

      return internationalCompetitionWords.some((word) => {
        return normalizedLeagueName.includes(word);
      });
    });

    return isInternationalTeam
      ? PlayerCareerTeamType.NATIONAL_TEAM
      : PlayerCareerTeamType.CLUB;
  }

  private getKnownClubTeamIds(
    transfers: PlayerCareerTransferSnapshot[],
  ): Set<string> {
    const ids = new Set<string>();

    for (const transfer of transfers) {
      if (transfer.fromTeamId) {
        ids.add(transfer.fromTeamId);
      }

      if (transfer.toTeamId) {
        ids.add(transfer.toTeamId);
      }
    }

    return ids;
  }

  //======= PostgreSQL Save Methods =======//

  private async replaceAllSeasonStats(
    playerId: string,
    rows: PlayerCareerSeasonStatInput[],
  ): Promise<void> {
    await this.seasonStatRepository.delete({
      playerId,
    });

    if (!rows.length) {
      return;
    }

    await this.seasonStatRepository.save(
      rows.map((row) => {
        return this.seasonStatRepository.create(row);
      }),
    );
  }

  private async replaceActiveSeasonStats(
    playerId: string,
    activeSeasons: number[],
    rows: PlayerCareerSeasonStatInput[],
  ): Promise<void> {
    await this.seasonStatRepository.update(
      {
        playerId,
      },
      {
        isCurrentTeam: false,
      },
    );

    for (const season of activeSeasons) {
      await this.seasonStatRepository.delete({
        playerId,
        season,
      });
    }

    if (!rows.length) {
      return;
    }

    await this.seasonStatRepository.save(
      rows.map((row) => {
        return this.seasonStatRepository.create(row);
      }),
    );
  }

  //======= Response Builder =======//

  private async buildCareerResponse(
    playerId: string,
    query: FootballCompositeQueryDto,
  ) {
    const [syncState, seasonRows, transfers] = await Promise.all([
      this.syncStateRepository.findOne({
        where: {
          playerId,
        },
      }),
      this.seasonStatRepository.find({
        where: {
          playerId,
        },
        order: {
          season: 'ASC',
        },
      }),
      this.transferSnapshotRepository.find({
        where: {
          playerId,
        },
        order: {
          transferDate: 'DESC',
        },
      }),
    ]);

    const seniorCareer = this.buildCareerCards(
      seasonRows.filter((row) => {
        return row.teamType === PlayerCareerTeamType.CLUB;
      }),
      transfers,
    );

    const nationalTeams = this.buildCareerCards(
      seasonRows.filter((row) => {
        return row.teamType === PlayerCareerTeamType.NATIONAL_TEAM;
      }),
      transfers,
    );

    const transferItems = transfers.map((transfer) => {
      return {
        id: transfer.id,
        date: transfer.transferDate,
        type: transfer.transferType,
        fromTeam: {
          id: transfer.fromTeamId,
          name: transfer.fromTeamName,
          logo: transfer.fromTeamLogo,
        },
        toTeam: {
          id: transfer.toTeamId,
          name: transfer.toTeamName,
          logo: transfer.toTeamLogo,
        },
      };
    });

    return {
      playerId,
      activeSeasons: this.getActiveRefreshSeasons(),
      seniorCareer: this.paginateArray(
        seniorCareer,
        query.page,
        query.limit,
        5,
      ),
      nationalTeams,
      transfers: this.paginateArray(
        transferItems,
        query.transferPage,
        query.transferLimit,
        10,
      ),
      cache: {
        source: 'POSTGRES',
        initialSyncCompleted: syncState?.initialSyncCompleted ?? false,
        fullSyncFromSeason: syncState?.fullSyncFromSeason ?? null,
        fullSyncToSeason: syncState?.fullSyncToSeason ?? null,
        currentStatsFreshUntil: syncState?.currentStatsFreshUntil ?? null,
        transfersLastSyncedAt: syncState?.transfersLastSyncedAt ?? null,
        lastSyncedAt: syncState?.lastSyncedAt ?? null,
        lastError: syncState?.lastError ?? null,
      },
    };
  }

  private buildCareerCards(
    rows: PlayerCareerSeasonStat[],
    transfers: PlayerCareerTransferSnapshot[],
  ): PlayerCareerTeamCard[] {
    const grouped = new Map<string, CareerCardAccumulator>();

    for (const row of rows) {
      const existing = grouped.get(row.teamId) ?? {
        team: {
          id: row.teamId,
          name: row.teamName,
          logo: row.teamLogo,
        },
        teamType: row.teamType,
        fromSeason: row.season,
        toSeason: row.season,
        isCurrent: false,
        matchesPlayed: 0,
        goals: 0,
      };

      existing.fromSeason = Math.min(existing.fromSeason, row.season);
      existing.toSeason = Math.max(existing.toSeason, row.season);
      existing.isCurrent = existing.isCurrent || row.isCurrentTeam;
      existing.matchesPlayed += row.appearances;
      existing.goals += row.goals;

      grouped.set(row.teamId, existing);
    }

    return Array.from(grouped.values())
      .map((item) => {
        const period =
          item.teamType === PlayerCareerTeamType.CLUB
            ? this.resolveClubPeriod(item, transfers)
            : {
                from: `${item.fromSeason}-01-01`,
                to: item.isCurrent ? null : `${item.toSeason}-12-31`,
              };

        return {
          team: item.team,
          from: period.from,
          to: period.to,
          isCurrent: item.isCurrent,
          matchesPlayed: item.matchesPlayed,
          goals: item.goals,
        };
      })
      .sort((left, right) => {
        if (left.isCurrent !== right.isCurrent) {
          return left.isCurrent ? -1 : 1;
        }

        return right.from.localeCompare(left.from);
      });
  }

  private resolveClubPeriod(
    career: CareerCardAccumulator,
    transfers: PlayerCareerTransferSnapshot[],
  ): {
    from: string;
    to: string | null;
  } {
    const incomingDates = transfers
      .filter((transfer) => {
        return transfer.toTeamId === career.team.id;
      })
      .map((transfer) => transfer.transferDate)
      .sort();

    const outgoingDates = transfers
      .filter((transfer) => {
        return transfer.fromTeamId === career.team.id;
      })
      .map((transfer) => transfer.transferDate)
      .sort();

    const fromDate = career.isCurrent
      ? (incomingDates[incomingDates.length - 1] ??
        `${career.fromSeason}-01-01`)
      : (incomingDates[0] ?? `${career.fromSeason}-01-01`);

    const toDate = career.isCurrent
      ? null
      : (outgoingDates[outgoingDates.length - 1] ?? `${career.toSeason}-12-31`);

    return {
      from: fromDate,
      to: toDate,
    };
  }

  //======= Sync State =======//

  private async ensureSyncState(
    playerId: string,
  ): Promise<PlayerCareerSyncState> {
    const existing = await this.syncStateRepository.findOne({
      where: {
        playerId,
      },
    });

    if (existing) {
      return existing;
    }

    const currentYear = this.getCurrentYear();

    return this.syncStateRepository.save(
      this.syncStateRepository.create({
        playerId,
        currentSeason: currentYear,
        initialSyncCompleted: false,
        fullSyncFromSeason: null,
        fullSyncToSeason: null,
        currentStatsFreshUntil: null,
        transfersLastSyncedAt: null,
        syncInProgress: false,
        syncStartedAt: null,
        lastSyncedAt: null,
        lastError: null,
      }),
    );
  }

  private async beginSync(
    playerId: string,
    throwWhenLocked: true,
  ): Promise<PlayerCareerSyncState>;

  private async beginSync(
    playerId: string,
    throwWhenLocked: false,
  ): Promise<PlayerCareerSyncState | null>;

  private async beginSync(
    playerId: string,
    throwWhenLocked: boolean,
  ): Promise<PlayerCareerSyncState | null> {
    const state = await this.ensureSyncState(playerId);

    if (state.syncInProgress && !this.canRestartSync(state)) {
      if (throwWhenLocked) {
        throw new ServiceUnavailableException(
          'Player career data is currently being prepared. Please try again shortly.',
        );
      }

      return null;
    }

    state.syncInProgress = true;
    state.syncStartedAt = new Date();
    state.lastError = null;

    return this.syncStateRepository.save(state);
  }

  private canRestartSync(state: PlayerCareerSyncState): boolean {
    if (!state.syncStartedAt) {
      return true;
    }

    const maxSyncDurationMinutes = this.toPositiveNumber(
      this.configService.get<string>('PLAYER_CAREER_MAX_SYNC_MINUTES'),
      60,
    );

    const maxSyncAgeMs = maxSyncDurationMinutes * 60 * 1000;

    return Date.now() - state.syncStartedAt.getTime() > maxSyncAgeMs;
  }

  private async completeSyncWithError(
    state: PlayerCareerSyncState,
    error: unknown,
  ): Promise<void> {
    state.syncInProgress = false;
    state.syncStartedAt = null;
    state.lastError = error instanceof Error ? error.message : String(error);

    await this.syncStateRepository.save(state);
  }

  private isCurrentCacheFresh(state: PlayerCareerSyncState): boolean {
    return (
      state.currentStatsFreshUntil !== null &&
      state.currentStatsFreshUntil.getTime() > Date.now()
    );
  }

  //======= Date / Env Helpers =======//

  private getCurrentYear(): number {
    return new Date().getUTCFullYear();
  }

  private getActiveRefreshSeasons(): number[] {
    const currentYear = this.getCurrentYear();

    return [currentYear - 1, currentYear];
  }

  private isActiveSeason(season: number): boolean {
    return this.getActiveRefreshSeasons().includes(season);
  }

  private getInitialFromSeason(): number {
    return this.toPositiveNumber(
      this.configService.get<string>('PLAYER_CAREER_INITIAL_FROM_SEASON'),
      2000,
    );
  }

  private createFreshUntil(): Date {
    const refreshMinutes = this.toPositiveNumber(
      this.configService.get<string>('PLAYER_CAREER_CURRENT_REFRESH_MINUTES'),
      30,
    );

    return new Date(Date.now() + refreshMinutes * 60 * 1000);
  }

  private normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private paginateArray<T>(
    items: T[],
    pageValue?: string,
    limitValue?: string,
    defaultLimit = 10,
  ) {
    const page = this.toPositiveNumber(pageValue, 1);
    const limit = this.toPositiveNumber(limitValue, defaultLimit);
    const total = items.length;
    const startIndex = (page - 1) * limit;

    return {
      items: items.slice(startIndex, startIndex + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private toPositiveNumber(value: unknown, fallback: number): number {
    const parsedValue = Number(value);

    if (
      value === undefined ||
      value === null ||
      value === '' ||
      Number.isNaN(parsedValue) ||
      parsedValue < 1
    ) {
      return fallback;
    }

    return Math.floor(parsedValue);
  }
}

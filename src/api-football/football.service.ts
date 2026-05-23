import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ApiFootballClient } from './api-football.client';
import { ApiFootballCacheService } from './api-football-cache.service';
import { apiFootballCacheConfig } from 'src/config/api-football-cache.config';
import { buildApiFootballCacheKey } from '../common/utils/api-football-cache-key.util';
import { RedisService } from '../redis/redis.service';
import { ApiFootballRequestPriority } from './enums/api-football-request-priority.enum';
import { LeagueFixturesQueryDto } from './dto/league-fixtures-query.dto';
import {
  ApiFootballFixturesResponse,
  FixturesByTimeResponse,
  LeagueFixturesGroup,
} from 'src/common/interfaces/api-football-custom-response.interface';
import { BackendPaginationParams } from 'src/common/interfaces/pagination.interface';

type QueryParams = Record<string, string | number | boolean | undefined>;
type ApiFootballResponse = unknown;

@Injectable()
export class FootballService {
  constructor(
    private readonly apiFootballCacheService: ApiFootballCacheService,
    private readonly apiFootballClient: ApiFootballClient,
    private readonly redisService: RedisService,
  ) {}

  private async cachedPaginated(
    endpoint: string,
    params: QueryParams,
    cacheConfig: { ttl: number; staleTtl: number },
    priority = ApiFootballRequestPriority.MEDIUM,
  ): Promise<ApiFootballResponse> {
    const { apiParams, page, limit, shouldPaginate } =
      this.extractBackendPaginationParams(params);

    const data = await this.cached(endpoint, apiParams, cacheConfig, priority);

    if (!shouldPaginate) {
      return data;
    }

    return this.paginateApiFootballResponse(data, page, limit);
  }

  private extractBackendPaginationParams(
    params: QueryParams,
  ): BackendPaginationParams {
    const { page, limit, ...apiParams } = params;

    return {
      apiParams,
      page: this.toPositiveNumber(page, 1),
      limit: this.toPositiveNumber(limit, 20),
      shouldPaginate: page !== undefined || limit !== undefined,
    };
  }

  private paginateApiFootballResponse(
    data: ApiFootballResponse,
    page: number,
    limit: number,
  ): ApiFootballResponse {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const responseData = data as {
      response?: unknown;
      results?: number;
    };

    if (!Array.isArray(responseData.response)) {
      return data;
    }

    const totalItems = responseData.response.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const paginatedResponse = responseData.response.slice(
      startIndex,
      startIndex + limit,
    );

    return {
      ...responseData,
      results: paginatedResponse.length,
      response: paginatedResponse,
      backendPaging: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  getLiveFixtures(): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures',
      { live: 'all' },
      apiFootballCacheConfig.liveFixtures,
      ApiFootballRequestPriority.HIGH,
    );
  }

  getFixtures(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated('/fixtures', query, this.getFixturesTtl(query));
  }

  getFixtureById(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures',
      { ids: fixtureId },
      apiFootballCacheConfig.liveFixtureDetail,
      ApiFootballRequestPriority.HIGH,
    );
  }

  getFixtureEvents(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures/events',
      { fixture: fixtureId },
      apiFootballCacheConfig.liveEvents,
      ApiFootballRequestPriority.HIGH,
    );
  }

  getFixtureStatistics(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures/statistics',
      { fixture: fixtureId },
      apiFootballCacheConfig.liveStats,
      ApiFootballRequestPriority.HIGH,
    );
  }

  getFixtureLineups(fixtureId: string): Promise<ApiFootballResponse> {
    return this.getFixtureLineupsCached(fixtureId);
  }

  getFixturePlayers(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures/players',
      { fixture: fixtureId },
      apiFootballCacheConfig.fixturesPast,
    );
  }

  async getFixturesByTime(query: {
    date: string;
    page?: string;
    limit?: string;
    timezone?: string;
    statusGroup?: 'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED';
  }): Promise<FixturesByTimeResponse> {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 20);
    const timezone = query.timezone ?? 'Asia/Dhaka';

    const fixturesResponse = (await this.getFixtures({
      date: query.date,
      timezone,
    })) as ApiFootballFixturesResponse;

    const filteredFixtures = this.filterFixturesByStatusGroup(
      fixturesResponse.response ?? [],
      query.statusGroup ?? 'ALL',
    );

    const sortedFixtures = filteredFixtures.sort((left, right) => {
      return left.fixture.timestamp - right.fixture.timestamp;
    });

    const totalFixtures = sortedFixtures.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = sortedFixtures.slice(startIndex, startIndex + limit);

    return {
      date: query.date,
      timezone,
      items: paginatedItems,
      meta: {
        page,
        limit,
        totalFixtures,
        totalPages: Math.ceil(totalFixtures / limit),
      },
    };
  }

  getHeadToHead(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures/headtohead',
      query,
      apiFootballCacheConfig.fixturesPast,
    );
  }

  getFixtureRounds(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures/rounds',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  getTeams(query: QueryParams): Promise<ApiFootballResponse> {
    const cacheConfig = query.search
      ? apiFootballCacheConfig.search
      : apiFootballCacheConfig.teamProfile;

    return this.cachedPaginated('/teams', query, cacheConfig);
  }

  getTeamFixtures(
    teamId: string,
    query: QueryParams,
  ): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures',
      {
        team: teamId,
        ...query,
      },
      this.getFixturesTtl(query),
    );
  }

  getLeagues(query: QueryParams): Promise<ApiFootballResponse> {
    const cacheConfig = query.search
      ? apiFootballCacheConfig.search
      : apiFootballCacheConfig.leagueProfile;

    return this.cachedPaginated('/leagues', query, cacheConfig);
  }

  getCountries(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/countries',
      query,
      apiFootballCacheConfig.leagueProfile,
      ApiFootballRequestPriority.LOW,
    );
  }

  getStandings(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/standings',
      query,
      apiFootballCacheConfig.standings,
    );
  }

  getPlayers(query: QueryParams): Promise<ApiFootballResponse> {
    const cacheConfig = query.search
      ? apiFootballCacheConfig.search
      : apiFootballCacheConfig.fixturesFuture;

    return this.cachedPaginated('/players', query, cacheConfig);
  }

  getPlayerSquads(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/players/squads',
      query,
      apiFootballCacheConfig.teamProfile,
    );
  }

  getTopScorers(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/players/topscorers',
      query,
      apiFootballCacheConfig.topScorers,
    );
  }

  getTopAssists(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/players/topassists',
      query,
      apiFootballCacheConfig.topAssists,
    );
  }

  // getTopCards(query: QueryParams): Promise<ApiFootballResponse> {
  //   return this.cachedPaginated(
  //     '/players/topcards',
  //     query,
  //     apiFootballCacheConfig.topScorers,
  //   );
  // }

  getTeamStatistics(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/teams/statistics',
      query,
      apiFootballCacheConfig.standings,
    );
  }

  getPlayersApiPage(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/players',
      query,
      apiFootballCacheConfig.fixturesFuture,
    );
  }

  getTransfers(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/transfers',
      query,
      apiFootballCacheConfig.transfers,
    );
  }

  getPlayerCareerSeasonStats(
    playerId: string,
    season: number,
    isCurrentSeason: boolean,
  ): Promise<ApiFootballResponse> {
    const endpoint = '/players';
    const params: QueryParams = {
      id: playerId,
      season,
    };

    const cacheKey = `api-football:player-career:${
      isCurrentSeason ? 'current' : 'history'
    }:${buildApiFootballCacheKey(endpoint, params)}`;

    const ttlSeconds = isCurrentSeason
      ? this.toPositiveNumber(
          process.env.CACHE_TTL_PLAYER_CAREER_CURRENT_SECONDS,
          1800,
        )
      : this.toPositiveNumber(
          process.env.CACHE_TTL_PLAYER_CAREER_HISTORY_SECONDS,
          2592000,
        );

    const staleTtlSeconds = isCurrentSeason
      ? this.toPositiveNumber(
          process.env.CACHE_STALE_PLAYER_CAREER_CURRENT_SECONDS,
          7200,
        )
      : this.toPositiveNumber(
          process.env.CACHE_STALE_PLAYER_CAREER_HISTORY_SECONDS,
          5184000,
        );

    return this.apiFootballCacheService.getCached<ApiFootballResponse>({
      endpoint,
      params,
      cacheKey,
      ttlSeconds,
      staleTtlSeconds,
      lockTtlSeconds: 10,
      priority: ApiFootballRequestPriority.LOW,
    });
  }

  getPlayerCareerTransfers(
    playerId: string,
    weeklyRefresh = false,
  ): Promise<ApiFootballResponse> {
    const endpoint = '/transfers';
    const params: QueryParams = {
      player: playerId,
    };

    const refreshSegment = weeklyRefresh
      ? `weekly:${new Date().toISOString().slice(0, 10)}`
      : 'initial';

    const cacheKey = `api-football:player-career:transfers:${refreshSegment}:${buildApiFootballCacheKey(
      endpoint,
      params,
    )}`;

    return this.apiFootballCacheService.getCached<ApiFootballResponse>({
      endpoint,
      params,
      cacheKey,
      ttlSeconds: this.toPositiveNumber(
        process.env.CACHE_TTL_PLAYER_CAREER_TRANSFERS_SECONDS,
        604800,
      ),
      staleTtlSeconds: this.toPositiveNumber(
        process.env.CACHE_STALE_PLAYER_CAREER_TRANSFERS_SECONDS,
        1209600,
      ),
      lockTtlSeconds: 10,
      priority: ApiFootballRequestPriority.LOW,
    });
  }

  getInjuries(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/injuries',
      query,
      apiFootballCacheConfig.transfers,
    );
  }

  getCoaches(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/coachs',
      query,
      apiFootballCacheConfig.teamProfile,
    );
  }

  getTrophies(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/trophies',
      query,
      apiFootballCacheConfig.leagueProfile,
      ApiFootballRequestPriority.LOW,
    );
  }

  getVenues(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/venues',
      query,
      apiFootballCacheConfig.leagueProfile,
      ApiFootballRequestPriority.LOW,
    );
  }

  getPredictions(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/predictions',
      query,
      apiFootballCacheConfig.fixturesToday,
      ApiFootballRequestPriority.LOW,
    );
  }

  getLeaguesSeasons(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/leagues/seasons',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  getPlayerProfiles(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/players/profiles',
      query,
      apiFootballCacheConfig.search,
    );
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

  async getFixturesGroupedByLeague(query: {
    date: string;
    page?: string;
    limit?: string;
    timezone?: string;
    statusGroup?: 'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED';
  }): Promise<{
    date: string;
    timezone: string;
    items: LeagueFixturesGroup[];
    meta: {
      page: number;
      limit: number;
      totalLeagues: number;
      totalPages: number;
      totalMatches: number;
    };
  }> {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 10);
    const timezone = query.timezone ?? 'Asia/Dhaka';

    const fixturesResponse = (await this.getFixtures({
      date: query.date,
      timezone,
    })) as ApiFootballFixturesResponse;

    const fixtures = this.filterFixturesByStatusGroup(
      fixturesResponse.response ?? [],
      query.statusGroup ?? 'ALL',
    );

    const groupedMap = new Map<number, LeagueFixturesGroup>();

    for (const fixture of fixtures) {
      const leagueId = fixture.league.id;
      const existingGroup = groupedMap.get(leagueId);

      if (!existingGroup) {
        groupedMap.set(leagueId, {
          league: {
            id: fixture.league.id,
            name: fixture.league.name,
            country: fixture.league.country,
            logo: fixture.league.logo,
            flag: fixture.league.flag,
            season: fixture.league.season,
            round: fixture.league.round,
            standings: fixture.league.standings,
          },
          matchCount: 1,
          fixtures: [fixture],
        });

        continue;
      }

      existingGroup.matchCount += 1;
      existingGroup.fixtures.push(fixture);
    }

    const groupedItems = Array.from(groupedMap.values())
      .map((group) => ({
        ...group,
        fixtures: group.fixtures.sort((left, right) => {
          return left.fixture.timestamp - right.fixture.timestamp;
        }),
      }))
      .sort((left, right) => {
        const leftFirstKickoff = left.fixtures[0]?.fixture.timestamp ?? 0;
        const rightFirstKickoff = right.fixtures[0]?.fixture.timestamp ?? 0;

        if (leftFirstKickoff !== rightFirstKickoff) {
          return leftFirstKickoff - rightFirstKickoff;
        }

        if (left.league.country !== right.league.country) {
          return left.league.country.localeCompare(right.league.country);
        }

        return left.league.name.localeCompare(right.league.name);
      });

    const totalLeagues = groupedItems.length;
    const totalMatches = fixtures.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = groupedItems.slice(startIndex, startIndex + limit);

    return {
      date: query.date,
      timezone,
      items: paginatedItems,
      meta: {
        page,
        limit,
        totalLeagues,
        totalPages: Math.ceil(totalLeagues / limit),
        totalMatches,
      },
    };
  }

  private filterFixturesByStatusGroup(
    fixtures: NonNullable<ApiFootballFixturesResponse['response']>,
    statusGroup: 'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED',
  ): NonNullable<ApiFootballFixturesResponse['response']> {
    if (statusGroup === 'ALL') {
      return fixtures;
    }

    const liveStatuses = new Set([
      '1H',
      'HT',
      '2H',
      'ET',
      'BT',
      'P',
      'SUSP',
      'INT',
    ]);

    const upcomingStatuses = new Set(['NS', 'TBD']);
    const finishedStatuses = new Set(['FT', 'AET', 'PEN', 'PSO']);

    return fixtures.filter((fixture) => {
      const status = fixture.fixture.status.short;

      if (statusGroup === 'LIVE') {
        return liveStatuses.has(status);
      }

      if (statusGroup === 'UPCOMING') {
        return upcomingStatuses.has(status);
      }

      if (statusGroup === 'FINISHED') {
        return finishedStatuses.has(status);
      }

      return true;
    });
  }

  async searchAll(
    query: string,
    options?: {
      season?: string;
      page?: string;
      limit?: string;
    },
  ): Promise<{
    teams: ApiFootballResponse;
    leagues: ApiFootballResponse;
    players: ApiFootballResponse;
  }> {
    if (!query || query.trim().length < 3) {
      throw new BadRequestException(
        'Search query must be at least 3 characters',
      );
    }

    const search = query.trim();

    const paginationParams = {
      page: options?.page,
      limit: options?.limit,
    };

    const [teams, leagues, players] = await Promise.all([
      this.cachedPaginated(
        '/teams',
        {
          search,
          ...paginationParams,
        },
        apiFootballCacheConfig.search,
      ),

      this.cachedPaginated(
        '/leagues',
        {
          search,
          ...paginationParams,
        },
        apiFootballCacheConfig.search,
      ),

      this.cachedPaginated(
        '/players/profiles',
        {
          search,
          ...paginationParams,
        },
        apiFootballCacheConfig.search,
      ),
    ]);

    return {
      teams,
      leagues,
      players,
    };
  }

  private cached(
    endpoint: string,
    params: QueryParams,
    cacheConfig: { ttl: number; staleTtl: number },
    priority = ApiFootballRequestPriority.MEDIUM,
  ): Promise<ApiFootballResponse> {
    const cacheKey = buildApiFootballCacheKey(endpoint, params);

    return this.apiFootballCacheService.getCached<ApiFootballResponse>({
      endpoint,
      params,
      cacheKey,
      ttlSeconds: cacheConfig.ttl,
      staleTtlSeconds: cacheConfig.staleTtl,
      lockTtlSeconds: 10,
      priority,
    });
  }

  private async getFixtureLineupsCached(
    fixtureId: string,
  ): Promise<ApiFootballResponse> {
    const endpoint = '/fixtures/lineups';
    const params = { fixture: fixtureId };
    const cacheKey = buildApiFootballCacheKey(endpoint, params);
    const staleKey = `${cacheKey}:stale`;
    const lockKey = `lock:${cacheKey}`;

    const cachedData =
      await this.redisService.get<ApiFootballResponse>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const hasLock = await this.redisService.setLock(lockKey, 10);

    if (hasLock) {
      try {
        const staleData =
          await this.redisService.get<ApiFootballResponse>(staleKey);

        try {
          await this.apiFootballCacheService.assertApiBudgetAllowsRequest(
            ApiFootballRequestPriority.HIGH,
          );
        } catch (error) {
          if (staleData) {
            return staleData;
          }

          throw error;
        }

        const freshData = await this.apiFootballClient.get<ApiFootballResponse>(
          endpoint,
          params,
        );

        const cacheConfig = this.getFixtureLineupsTtl(freshData);

        await this.redisService.set(cacheKey, freshData, cacheConfig.ttl);
        await this.redisService.set(staleKey, freshData, cacheConfig.staleTtl);

        await this.apiFootballCacheService.trackApiUsage();

        return freshData;
      } finally {
        await this.redisService.del(lockKey);
      }
    }

    const dataAfterWait =
      await this.waitForFreshCache<ApiFootballResponse>(cacheKey);

    if (dataAfterWait) {
      return dataAfterWait;
    }

    const staleData =
      await this.redisService.get<ApiFootballResponse>(staleKey);

    if (staleData) {
      return staleData;
    }

    throw new ServiceUnavailableException(
      'Data is loading. Please try again shortly.',
    );
  }

  private getFixturesTtl(query: QueryParams): {
    ttl: number;
    staleTtl: number;
  } {
    if (query.live) {
      return apiFootballCacheConfig.liveFixtures;
    }

    if (query.ids) {
      return apiFootballCacheConfig.liveFixtureDetail;
    }

    if (query.date) {
      const today = new Date().toISOString().slice(0, 10);
      const date = String(query.date);

      if (date === today) {
        return apiFootballCacheConfig.fixturesToday;
      }

      if (date > today) {
        return apiFootballCacheConfig.fixturesFuture;
      }

      return apiFootballCacheConfig.fixturesPast;
    }

    if (query.next || query.last) {
      return apiFootballCacheConfig.fixturesToday;
    }

    return apiFootballCacheConfig.fixturesToday;
  }

  private getFixtureLineupsTtl(response: ApiFootballResponse): {
    ttl: number;
    staleTtl: number;
  } {
    if (this.hasFixtureLineups(response)) {
      return apiFootballCacheConfig.lineupsAfterFound;
    }

    return apiFootballCacheConfig.lineupsBeforeFound;
  }

  private hasFixtureLineups(response: ApiFootballResponse): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    const lineupResponse = response as { response?: unknown };

    return (
      Array.isArray(lineupResponse.response) &&
      lineupResponse.response.length > 0
    );
  }

  private async waitForFreshCache<T>(cacheKey: string): Promise<T | null> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.delay(200);

      const cachedData = await this.redisService.get<T>(cacheKey);

      if (cachedData) {
        return cachedData;
      }
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

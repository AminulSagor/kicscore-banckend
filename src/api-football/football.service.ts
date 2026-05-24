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
import {
  FootballSearchApiResponse,
  FootballSearchLeagueItem,
  FootballSearchPlayerItem,
} from './types/football-search.type';
import {
  FootballSearchPromotion,
  LEAGUE_SEARCH_PROMOTIONS,
  PLAYER_SEARCH_PROMOTIONS,
  PlayerSearchPromotion,
} from 'src/common/constants/football-search-ranking.constant';

type QueryParams = Record<string, string | number | boolean | undefined>;
type ApiFootballResponse = unknown;

type SearchPromotionLike = {
  aliases: readonly string[];
  priority: number;
};

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

  getWorldCupFinalFixture(season: string): Promise<ApiFootballResponse> {
    return this.cachedPaginated(
      '/fixtures',
      {
        league: '1',
        season,
        round: 'Final',
      },
      apiFootballCacheConfig.worldCupFinal,
      ApiFootballRequestPriority.LOW,
    );
  }

  async getLeagues(query: QueryParams): Promise<ApiFootballResponse> {
    if (this.hasSearchText(query.search)) {
      return this.searchLeaguesWithRanking(query);
    }

    return this.cachedPaginated(
      '/leagues',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  //======= Enhanced League Search =======//

  private async searchLeaguesWithRanking(
    query: QueryParams,
  ): Promise<ApiFootballResponse> {
    const search = String(query.search).trim();
    const normalizedSearch = this.normalizeSearchText(search);
    const upstreamQuery = this.removeBackendPagination(query);

    const rawResponse = (await this.cached(
      '/leagues',
      upstreamQuery,
      apiFootballCacheConfig.search,
    )) as unknown as FootballSearchApiResponse<FootballSearchLeagueItem>;

    const sourceItems = rawResponse.response ?? [];
    const existingIds = new Set(
      sourceItems
        .map((item) => item.league?.id)
        .filter((id): id is number => typeof id === 'number'),
    );

    const matchingPromotions = LEAGUE_SEARCH_PROMOTIONS.filter((promotion) => {
      return this.isPromotionMatch(normalizedSearch, promotion);
    });

    const missingPromotions = matchingPromotions.filter((promotion) => {
      return !existingIds.has(promotion.id);
    });

    const supplementalItems =
      await this.fetchPromotedLeagues(missingPromotions);

    const mergedItems = this.mergeLeagueItems(sourceItems, supplementalItems);

    const rankedItems = mergedItems
      .map((item, index) => ({
        item,
        index,
        score: this.getLeagueSearchScore(item, normalizedSearch),
      }))
      .sort((left, right) => {
        return right.score - left.score || left.index - right.index;
      })
      .map((row) => row.item);

    return this.paginateEnhancedSearchResponse(
      rawResponse,
      rankedItems,
      query.page,
      query.limit,
    );
  }

  private async fetchPromotedLeagues(
    promotions: readonly FootballSearchPromotion[],
  ): Promise<FootballSearchLeagueItem[]> {
    if (!promotions.length) {
      return [];
    }

    const responses = await Promise.all(
      promotions.map(async (promotion) => {
        const response = (await this.cached(
          '/leagues',
          {
            id: String(promotion.id),
          },
          apiFootballCacheConfig.leagueProfile,
        )) as unknown as FootballSearchApiResponse<FootballSearchLeagueItem>;

        return response.response ?? [];
      }),
    );

    return responses.flat();
  }

  private mergeLeagueItems(
    sourceItems: FootballSearchLeagueItem[],
    supplementalItems: FootballSearchLeagueItem[],
  ): FootballSearchLeagueItem[] {
    const map = new Map<number, FootballSearchLeagueItem>();

    for (const item of [...supplementalItems, ...sourceItems]) {
      const id = item.league?.id;

      if (typeof id === 'number') {
        map.set(id, item);
      }
    }

    return Array.from(map.values());
  }

  private getLeagueSearchScore(
    item: FootballSearchLeagueItem,
    normalizedSearch: string,
  ): number {
    const leagueId = item.league?.id;
    const leagueName = item.league?.name ?? '';

    const promotion = LEAGUE_SEARCH_PROMOTIONS.find((entry) => {
      return entry.id === leagueId;
    });

    const nameScore = this.getSearchTextScore(normalizedSearch, leagueName);

    const promotionScore = promotion
      ? this.getPromotionScore(normalizedSearch, promotion)
      : 0;

    return Math.max(nameScore, promotionScore);
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

  async getPlayerProfiles(query: QueryParams): Promise<ApiFootballResponse> {
    if (!this.hasSearchText(query.search)) {
      return this.cachedPaginated(
        '/players/profiles',
        query,
        apiFootballCacheConfig.search,
      );
    }

    return this.searchPlayerProfilesWithRanking(query);
  }

  //======= Enhanced Player Search =======//

  private async searchPlayerProfilesWithRanking(
    query: QueryParams,
  ): Promise<ApiFootballResponse> {
    const search = String(query.search).trim();
    const normalizedSearch = this.normalizeSearchText(search);
    const upstreamQuery = this.removeBackendPagination(query);

    const rawResponse = (await this.cached(
      '/players/profiles',
      upstreamQuery,
      apiFootballCacheConfig.search,
    )) as unknown as FootballSearchApiResponse<FootballSearchPlayerItem>;

    const sourceItems = rawResponse.response ?? [];

    const matchingPromotions = PLAYER_SEARCH_PROMOTIONS.filter((promotion) => {
      return this.isPromotionMatch(normalizedSearch, promotion);
    });

    const supplementalItems = await this.fetchMissingPromotedPlayers(
      sourceItems,
      matchingPromotions,
    );

    const mergedItems = this.mergePlayerItems(sourceItems, supplementalItems);

    const rankedItems = mergedItems
      .map((item, index) => ({
        item,
        index,
        score: this.getPlayerSearchScore(item, normalizedSearch),
      }))
      .sort((left, right) => {
        return right.score - left.score || left.index - right.index;
      })
      .map((row) => row.item);

    return this.paginateEnhancedSearchResponse(
      rawResponse,
      rankedItems,
      query.page,
      query.limit,
    );
  }

  private mergePlayerItems(
    sourceItems: FootballSearchPlayerItem[],
    supplementalItems: FootballSearchPlayerItem[],
  ): FootballSearchPlayerItem[] {
    const map = new Map<number, FootballSearchPlayerItem>();

    for (const item of [...supplementalItems, ...sourceItems]) {
      const id = item.player?.id;

      if (typeof id === 'number') {
        map.set(id, item);
      }
    }

    return Array.from(map.values());
  }

  private async fetchMissingPromotedPlayers(
    sourceItems: FootballSearchPlayerItem[],
    promotions: readonly PlayerSearchPromotion[],
  ): Promise<FootballSearchPlayerItem[]> {
    const supplementalItems: FootballSearchPlayerItem[] = [];

    for (const promotion of promotions) {
      const alreadyExists = sourceItems.some((item) => {
        return this.isPromotedPlayerMatch(item, promotion);
      });

      if (alreadyExists) {
        continue;
      }

      const resolvedPlayer = await this.resolvePromotedPlayerProfile(promotion);

      if (resolvedPlayer) {
        supplementalItems.push(resolvedPlayer);
      }
    }

    return supplementalItems;
  }

  private async resolvePromotedPlayerProfile(
    promotion: PlayerSearchPromotion,
  ): Promise<FootballSearchPlayerItem | null> {
    if (promotion.id) {
      const idResponse = (await this.cached(
        '/players/profiles',
        {
          player: String(promotion.id),
        },
        apiFootballCacheConfig.search,
      )) as unknown as FootballSearchApiResponse<FootballSearchPlayerItem>;

      const idMatch = (idResponse.response ?? []).find((item) => {
        return item.player?.id === promotion.id;
      });

      if (idMatch) {
        return idMatch;
      }
    }

    const searchResponse = (await this.cached(
      '/players/profiles',
      {
        search: promotion.lookupQuery,
      },
      apiFootballCacheConfig.search,
    )) as unknown as FootballSearchApiResponse<FootballSearchPlayerItem>;

    return (
      (searchResponse.response ?? []).find((item) => {
        return this.isPromotedPlayerMatch(item, promotion);
      }) ?? null
    );
  }

  private getPlayerSearchScore(
    item: FootballSearchPlayerItem,
    normalizedSearch: string,
  ): number {
    const searchableName = this.getPlayerSearchableName(item);

    const directNameScore = this.getSearchTextScore(
      normalizedSearch,
      searchableName,
    );

    const matchedPromotion = PLAYER_SEARCH_PROMOTIONS.find((promotion) => {
      return (
        this.isPromotionMatch(normalizedSearch, promotion) &&
        this.isPromotedPlayerMatch(item, promotion)
      );
    });

    if (!matchedPromotion) {
      return directNameScore;
    }

    return Math.max(
      directNameScore,
      this.getPromotionScore(normalizedSearch, matchedPromotion),
    );
  }

  private isPromotedPlayerMatch(
    item: FootballSearchPlayerItem,
    promotion: PlayerSearchPromotion,
  ): boolean {
    if (promotion.id && item.player?.id === promotion.id) {
      return true;
    }

    const searchableName = this.getPlayerSearchableName(item);
    const normalizedCandidate = this.normalizeSearchText(searchableName);
    const normalizedCanonicalName = this.normalizeSearchText(
      promotion.canonicalName,
    );

    const canonicalTokens = normalizedCanonicalName
      .split(' ')
      .filter((token) => token.length > 1);

    if (canonicalTokens.length === 1) {
      return (
        this.normalizeSearchText(item.player?.name ?? '') ===
        normalizedCanonicalName
      );
    }

    return canonicalTokens.every((token) => {
      return normalizedCandidate.includes(token);
    });
  }

  private getPlayerSearchableName(item: FootballSearchPlayerItem): string {
    return [item.player?.name, item.player?.firstname, item.player?.lastname]
      .filter((value): value is string => Boolean(value))
      .join(' ');
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

    const paginationParams: QueryParams = {
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

      this.getLeagues({
        search,
        ...paginationParams,
      }),

      this.getPlayerProfiles({
        search,
        ...paginationParams,
      }),
    ]);

    return {
      teams,
      leagues,
      players,
    };
  }

  //======= Search Ranking Helpers =======//

  private hasSearchText(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private removeBackendPagination(query: QueryParams): QueryParams {
    const { page: _page, limit: _limit, ...upstreamQuery } = query;

    return upstreamQuery;
  }

  private isPromotionMatch(
    normalizedSearch: string,
    promotion: SearchPromotionLike,
  ): boolean {
    return promotion.aliases.some((alias) => {
      return this.getSearchTextScore(normalizedSearch, alias) >= 5000;
    });
  }

  private getPromotionScore(
    normalizedSearch: string,
    promotion: SearchPromotionLike,
  ): number {
    const bestAliasScore = Math.max(
      ...promotion.aliases.map((alias) => {
        return this.getSearchTextScore(normalizedSearch, alias);
      }),
      0,
    );

    return bestAliasScore > 0 ? bestAliasScore + promotion.priority : 0;
  }

  private getSearchTextScore(
    normalizedSearch: string,
    candidate: string,
  ): number {
    const normalizedCandidate = this.normalizeSearchText(candidate);

    if (!normalizedCandidate) {
      return 0;
    }

    if (normalizedCandidate === normalizedSearch) {
      return 10000;
    }

    if (normalizedCandidate.startsWith(normalizedSearch)) {
      return 8000;
    }

    const candidateWords = normalizedCandidate.split(' ');

    if (candidateWords.includes(normalizedSearch)) {
      return 7500;
    }

    if (normalizedCandidate.includes(normalizedSearch)) {
      return 6000;
    }

    if (
      normalizedSearch.length >= 4 &&
      this.getLevenshteinDistance(normalizedSearch, normalizedCandidate) <= 1
    ) {
      return 5000;
    }

    return 0;
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getLevenshteinDistance(left: string, right: string): number {
    const rows = left.length + 1;
    const columns = right.length + 1;

    const matrix = Array.from({ length: rows }, () => {
      return Array<number>(columns).fill(0);
    });

    for (let row = 0; row < rows; row += 1) {
      matrix[row][0] = row;
    }

    for (let column = 0; column < columns; column += 1) {
      matrix[0][column] = column;
    }

    for (let row = 1; row < rows; row += 1) {
      for (let column = 1; column < columns; column += 1) {
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;

        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + cost,
        );
      }
    }

    return matrix[left.length][right.length];
  }

  private paginateEnhancedSearchResponse<T>(
    sourceResponse: FootballSearchApiResponse<T>,
    rankedItems: T[],
    pageValue?: string | number | boolean,
    limitValue?: string | number | boolean,
  ): ApiFootballResponse {
    const hasPagination = pageValue !== undefined || limitValue !== undefined;

    if (!hasPagination) {
      return {
        ...sourceResponse,
        results: rankedItems.length,
        response: rankedItems,
      } as unknown as ApiFootballResponse;
    }

    const page = this.toPositiveNumber(pageValue, 1);
    const limit = this.toPositiveNumber(limitValue, 10);
    const totalItems = rankedItems.length;
    const startIndex = (page - 1) * limit;

    return {
      ...sourceResponse,
      results: totalItems,
      response: rankedItems.slice(startIndex, startIndex + limit),
      backendPaging: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    } as unknown as ApiFootballResponse;
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

  //======= Featured Lists Profile Fetch =======//

  getFeaturedTeamProfile(search: string): Promise<ApiFootballResponse> {
    return this.getFeaturedProfile('/teams', { search });
  }

  getFeaturedPlayerProfile(search: string): Promise<ApiFootballResponse> {
    return this.getFeaturedProfile('/players/profiles', { search });
  }

  getFeaturedPlayerProfileById(playerId: number): Promise<ApiFootballResponse> {
    return this.getFeaturedProfile('/players/profiles', {
      player: String(playerId),
    });
  }

  private getFeaturedProfile(
    endpoint: string,
    params: QueryParams,
  ): Promise<ApiFootballResponse> {
    const ttlSeconds = this.toPositiveNumber(
      process.env.CACHE_TTL_FEATURED_LISTS_SECONDS,
      86400,
    );

    const staleTtlSeconds = this.toPositiveNumber(
      process.env.CACHE_STALE_FEATURED_LISTS_SECONDS,
      86400,
    );

    const cacheKey = `api-football:featured-profile:${buildApiFootballCacheKey(
      endpoint,
      params,
    )}`;

    return this.apiFootballCacheService.getCached<ApiFootballResponse>({
      endpoint,
      params,
      cacheKey,
      ttlSeconds,
      staleTtlSeconds,
      lockTtlSeconds: 20,
      priority: ApiFootballRequestPriority.LOW,
    });
  }
}

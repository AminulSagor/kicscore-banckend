import { Injectable, BadRequestException } from '@nestjs/common';
import { ApiFootballCacheService } from './api-football-cache.service';
import { apiFootballCacheConfig } from 'src/config/api-football-cache.config';
import { buildApiFootballCacheKey } from '../common/utils/api-football-cache-key.util';

type QueryParams = Record<string, string | number | boolean | undefined>;
type ApiFootballResponse = unknown;

@Injectable()
export class FootballService {
  constructor(
    private readonly apiFootballCacheService: ApiFootballCacheService,
  ) {}

  getLiveFixtures(): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures',
      { live: 'all' },
      apiFootballCacheConfig.liveFixtures,
    );
  }

  getFixtures(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached('/fixtures', query, this.getFixturesTtl(query));
  }

  getFixtureById(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures',
      { ids: fixtureId },
      apiFootballCacheConfig.liveFixtureDetail,
    );
  }

  getFixtureEvents(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures/events',
      { fixture: fixtureId },
      apiFootballCacheConfig.liveEvents,
    );
  }

  getFixtureStatistics(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures/statistics',
      { fixture: fixtureId },
      apiFootballCacheConfig.liveStats,
    );
  }

  getFixtureLineups(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures/lineups',
      { fixture: fixtureId },
      apiFootballCacheConfig.lineupsBeforeFound,
    );
  }

  getFixturePlayers(fixtureId: string): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures/players',
      { fixture: fixtureId },
      apiFootballCacheConfig.fixturesPast,
    );
  }

  getHeadToHead(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures/headtohead',
      query,
      apiFootballCacheConfig.fixturesPast,
    );
  }

  getFixtureRounds(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures/rounds',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  getTeams(query: QueryParams): Promise<ApiFootballResponse> {
    const cacheConfig = query.search
      ? apiFootballCacheConfig.search
      : apiFootballCacheConfig.teamProfile;

    return this.cached('/teams', query, cacheConfig);
  }

  getTeamFixtures(
    teamId: string,
    query: QueryParams,
  ): Promise<ApiFootballResponse> {
    return this.cached(
      '/fixtures',
      {
        team: teamId,
        ...query,
      },
      apiFootballCacheConfig.fixturesToday,
    );
  }

  getLeagues(query: QueryParams): Promise<ApiFootballResponse> {
    const cacheConfig = query.search
      ? apiFootballCacheConfig.search
      : apiFootballCacheConfig.leagueProfile;

    return this.cached('/leagues', query, cacheConfig);
  }

  getCountries(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/countries',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  getStandings(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached('/standings', query, apiFootballCacheConfig.standings);
  }

  getPlayers(query: QueryParams): Promise<ApiFootballResponse> {
    const cacheConfig = query.search
      ? apiFootballCacheConfig.search
      : apiFootballCacheConfig.fixturesFuture;

    return this.cached('/players', query, cacheConfig);
  }

  getPlayerSquads(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/players/squads',
      query,
      apiFootballCacheConfig.teamProfile,
    );
  }

  getTopScorers(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/players/topscorers',
      query,
      apiFootballCacheConfig.topScorers,
    );
  }

  getTopAssists(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/players/topassists',
      query,
      apiFootballCacheConfig.topAssists,
    );
  }

  getTransfers(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached('/transfers', query, apiFootballCacheConfig.transfers);
  }

  getInjuries(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached('/injuries', query, apiFootballCacheConfig.transfers);
  }

  getCoaches(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached('/coachs', query, apiFootballCacheConfig.teamProfile);
  }

  getTrophies(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/trophies',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  getVenues(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached('/venues', query, apiFootballCacheConfig.leagueProfile);
  }

  getPredictions(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/predictions',
      query,
      apiFootballCacheConfig.fixturesToday,
    );
  }

  getLeaguesSeasons(query: QueryParams): Promise<ApiFootballResponse> {
    return this.cached(
      '/leagues/seasons',
      query,
      apiFootballCacheConfig.leagueProfile,
    );
  }

  async searchAll(
    query: string,
    season: string,
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

    const [teams, leagues, players] = await Promise.all([
      this.cached('/teams', { search }, apiFootballCacheConfig.search),
      this.cached('/leagues', { search }, apiFootballCacheConfig.search),
      this.cached(
        '/players',
        { search, season },
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
  ): Promise<ApiFootballResponse> {
    const cacheKey = buildApiFootballCacheKey(endpoint, params);

    return this.apiFootballCacheService.getCached<ApiFootballResponse>({
      endpoint,
      params,
      cacheKey,
      ttlSeconds: cacheConfig.ttl,
      staleTtlSeconds: cacheConfig.staleTtl,
      lockTtlSeconds: 10,
    });
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
}

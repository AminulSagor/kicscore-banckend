import { Injectable } from '@nestjs/common';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FollowsService } from 'src/modules/follows/follows.service';
import { FootballCompositeQueryDto } from './dto/football-composite-query.dto';
import { FootballService } from './football.service';

type ApiFootballResponse = unknown;

interface ApiFootballWrapped<T> {
  response?: T[];
  results?: number;
}

@Injectable()
export class FootballCompositeService {
  constructor(
    private readonly footballService: FootballService,
    private readonly followsService: FollowsService,
  ) {}

  async getTopLeagues(query: FootballCompositeQueryDto) {
    return this.getPopularEntities({
      entityType: FollowEntityType.LEAGUE,
      page: query.page,
      limit: query.limit,
    });
  }

  async getLeaguesByCountry(query: FootballCompositeQueryDto) {
    const data = (await this.footballService.getLeagues({
      country: query.country,
      season: query.season,
    })) as ApiFootballWrapped<unknown>;

    return this.paginateArray(data.response ?? [], query.page, query.limit);
  }

  async getPopularEntities(query: {
    entityType: FollowEntityType;
    page?: string;
    limit?: string;
  }) {
    const follows = await this.followsService.findActiveFollowsByEntityTypes([
      query.entityType,
    ]);

    const grouped = new Map<
      string,
      {
        entityType: FollowEntityType;
        entityId: string;
        entityName: string | null;
        entityLogo: string | null;
        followersCount: number;
      }
    >();

    for (const follow of follows) {
      const existing = grouped.get(follow.entityId);

      if (!existing) {
        grouped.set(follow.entityId, {
          entityType: follow.entityType,
          entityId: follow.entityId,
          entityName: follow.entitySnapshot?.entityName ?? null,
          entityLogo: follow.entitySnapshot?.entityLogo ?? null,
          followersCount: 1,
        });

        continue;
      }

      existing.followersCount += 1;
    }

    const sorted = Array.from(grouped.values()).sort(
      (left, right) => right.followersCount - left.followersCount,
    );

    return this.paginateArray(sorted, query.page, query.limit);
  }

  async getMatchAbout(fixtureId: string) {
    const fixture = await this.footballService.getFixtureById(fixtureId);

    return {
      fixtureId,
      source: {
        fixture,
      },
      about:
        'This match preview is generated from fixture metadata. Add standings and H2H enrichment later for a richer paragraph.',
    };
  }

  async getKnockoutBracket(
    fixtureId: string,
    query: FootballCompositeQueryDto,
  ) {
    if (!query.league || !query.season) {
      return {
        fixtureId,
        rounds: [],
        message: 'league and season are required',
      };
    }

    const rounds = (await this.footballService.getFixtureRounds({
      league: query.league,
      season: query.season,
    })) as ApiFootballWrapped<string>;

    const roundNames = rounds.response ?? [];

    const bracketRounds = await Promise.all(
      roundNames.map(async (roundName) => {
        const fixtures = await this.footballService.getFixtures({
          league: query.league,
          season: query.season,
          round: roundName,
        });

        return {
          round: roundName,
          fixtures,
        };
      }),
    );

    return {
      fixtureId,
      league: query.league,
      season: query.season,
      rounds: bracketRounds,
    };
  }

  async getMatchTopScorersComparison(
    fixtureId: string,
    query: FootballCompositeQueryDto,
  ) {
    if (!query.league || !query.season) {
      return {
        fixtureId,
        players: [],
        message: 'league and season are required',
      };
    }

    const fixture = await this.footballService.getFixtureById(fixtureId);
    const players = await this.footballService.getPlayers({
      league: query.league,
      season: query.season,
      page: query.page,
      limit: query.limit,
    });

    return {
      fixtureId,
      fixture,
      players,
    };
  }

  async getTeamOverview(teamId: string, query: FootballCompositeQueryDto) {
    const [team, nextMatch, lastMatches, leagues, standings, squad, coach] =
      await Promise.all([
        this.footballService.getTeams({ id: teamId }),
        this.footballService.getTeamFixtures(teamId, { next: '1' }),
        this.footballService.getTeamFixtures(teamId, { last: '6' }),
        this.footballService.getLeagues({
          team: teamId,
          season: query.season,
        }),
        query.league && query.season
          ? this.footballService.getStandings({
              league: query.league,
              season: query.season,
            })
          : Promise.resolve(null),
        this.footballService.getPlayerSquads({ team: teamId }),
        this.footballService.getCoaches({ team: teamId }),
      ]);

    return {
      teamId,
      team,
      nextMatch,
      lastMatches,
      leagues,
      standings,
      squad,
      coach,
    };
  }

  async getTeamTopPlayers(teamId: string, query: FootballCompositeQueryDto) {
    const players = (await this.footballService.getPlayers({
      team: teamId,
      season: query.season,
      page: query.page,
      limit: query.limit,
    })) as ApiFootballWrapped<any>;

    const response = players.response ?? [];

    const sorted = response.sort((left, right) => {
      const leftStats = left.statistics?.[0];
      const rightStats = right.statistics?.[0];

      const leftGoals = leftStats?.goals?.total ?? 0;
      const rightGoals = rightStats?.goals?.total ?? 0;

      return rightGoals - leftGoals;
    });

    return this.paginateArray(sorted, query.page, query.limit);
  }

  async getTeamAbout(teamId: string, query: FootballCompositeQueryDto) {
    const overview = await this.getTeamOverview(teamId, query);

    return {
      teamId,
      source: overview,
      about:
        'This team summary is generated from team profile, recent matches, standings, squad, and coach data.',
    };
  }

  async getTeamTrophiesPreview(
    teamId: string,
    query: FootballCompositeQueryDto,
  ) {
    const fromSeason = Number(query.fromSeason ?? 2020);
    const toSeason = Number(query.toSeason ?? new Date().getFullYear());

    const seasons = Array.from(
      { length: toSeason - fromSeason + 1 },
      (_, index) => fromSeason + index,
    );

    const results = await Promise.all(
      seasons.map(async (season) => {
        const leagues = await this.footballService.getLeagues({
          team: teamId,
          season,
        });

        return {
          season,
          leagues,
        };
      }),
    );

    return this.paginateArray(results, query.page, query.limit);
  }

  async getPlayerRecentMatches(
    playerId: string,
    query: FootballCompositeQueryDto,
  ) {
    if (!query.team) {
      return {
        playerId,
        items: [],
        message: 'team is required to fetch recent player matches',
      };
    }

    const fixtures = await this.footballService.getTeamFixtures(query.team, {
      last: query.last ?? '10',
      page: query.page,
      limit: query.limit,
    });

    return {
      playerId,
      teamId: query.team,
      fixtures,
    };
  }

  async getPlayerCareerTotals(
    playerId: string,
    query: FootballCompositeQueryDto,
  ) {
    const fromSeason = Number(query.fromSeason ?? 2020);
    const toSeason = Number(query.toSeason ?? new Date().getFullYear());

    const seasons = Array.from(
      { length: toSeason - fromSeason + 1 },
      (_, index) => fromSeason + index,
    );

    const rows = await Promise.all(
      seasons.map(async (season) => {
        const player = await this.footballService.getPlayers({
          id: playerId,
          season,
        });

        return {
          season,
          player,
        };
      }),
    );

    return this.paginateArray(rows, query.page, query.limit);
  }

  async getPlayerTraits(playerId: string, query: FootballCompositeQueryDto) {
    if (!query.league || !query.season) {
      return {
        playerId,
        traits: null,
        message: 'league and season are required',
      };
    }

    const [player, leaguePlayers] = await Promise.all([
      this.footballService.getPlayers({
        id: playerId,
        season: query.season,
      }),
      this.footballService.getPlayers({
        league: query.league,
        season: query.season,
      }),
    ]);

    return {
      playerId,
      player,
      leaguePlayers,
      traits:
        'Use this data to calculate frontend/backend percentile radar traits.',
    };
  }

  async getGroupedPlayerTrophies(
    playerId: string,
    query: FootballCompositeQueryDto,
  ) {
    const trophies = (await this.footballService.getTrophies({
      player: playerId,
    })) as ApiFootballWrapped<any>;

    return this.groupTrophies(trophies.response ?? [], query.page, query.limit);
  }

  async getGroupedCoachTrophies(
    coachId: string,
    query: FootballCompositeQueryDto,
  ) {
    const trophies = (await this.footballService.getTrophies({
      coach: coachId,
    })) as ApiFootballWrapped<any>;

    return this.groupTrophies(trophies.response ?? [], query.page, query.limit);
  }

  async getCoachCurrentRecord(
    coachId: string,
    query: FootballCompositeQueryDto,
  ) {
    if (!query.team || !query.from || !query.to) {
      return {
        coachId,
        record: null,
        message: 'team, from, and to are required',
      };
    }

    const fixtures = (await this.footballService.getTeamFixtures(query.team, {
      from: query.from,
      to: query.to,
    })) as ApiFootballWrapped<any>;

    const response = fixtures.response ?? [];

    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const fixture of response) {
      const homeTeamId = String(fixture.teams?.home?.id);
      const awayTeamId = String(fixture.teams?.away?.id);
      const homeGoals = fixture.goals?.home ?? 0;
      const awayGoals = fixture.goals?.away ?? 0;

      if (homeGoals === awayGoals) {
        draws += 1;
      } else if (
        (homeTeamId === query.team && homeGoals > awayGoals) ||
        (awayTeamId === query.team && awayGoals > homeGoals)
      ) {
        wins += 1;
      } else {
        losses += 1;
      }
    }

    return {
      coachId,
      teamId: query.team,
      from: query.from,
      to: query.to,
      record: {
        matches: response.length,
        wins,
        draws,
        losses,
      },
    };
  }

  private groupTrophies(items: any[], page?: string, limit?: string) {
    const grouped = new Map<
      string,
      {
        group: string;
        trophies: any[];
      }
    >();

    for (const item of items) {
      const group = item.team?.name ?? item.league ?? item.country ?? 'Other';

      const existing = grouped.get(group);

      if (!existing) {
        grouped.set(group, {
          group,
          trophies: [item],
        });

        continue;
      }

      existing.trophies.push(item);
    }

    return this.paginateArray(Array.from(grouped.values()), page, limit);
  }

  private paginateArray<T>(
    items: T[],
    pageValue?: string,
    limitValue?: string,
  ) {
    const page = this.toPositiveNumber(pageValue, 1);
    const limit = this.toPositiveNumber(limitValue, 20);
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

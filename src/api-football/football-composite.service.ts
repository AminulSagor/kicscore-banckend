import { Injectable } from '@nestjs/common';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FollowsService } from 'src/modules/follows/follows.service';
import { FootballCompositeQueryDto } from './dto/football-composite-query.dto';
import { FootballService } from './football.service';
import {
  FixtureItem,
  PlayerStatsItem,
  StandingLeagueBlock,
  StandingRow,
  TeamProfileItem,
} from 'src/common/interfaces/api-football-custom-response.interface';
import { FollowContext } from 'src/modules/follows/types/follow-context.type';
import { TOP_LEAGUE_IDS_PARAM } from 'src/common/constants/top-league-ids.constant';
import { FootballLeaguesByIdsQueryDto } from './dto/football-leagues-by-ids-query.dto';

type PlayerStatistic = NonNullable<PlayerStatsItem['statistics']>[number];

type FollowMeta = {
  isFollowed: boolean;
  entityType: FollowEntityType;
  entityId: string;
};

type LeagueProfileItem = {
  league?: {
    id?: number;
    name?: string;
  };
  [key: string]: unknown;
};

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

  async withFollowMeta<T extends object>(
    data: T,
    context?: FollowContext,
  ): Promise<T & { follow: FollowMeta | null }> {
    const follow = await this.buildFollowMeta(context);

    return {
      ...data,
      follow,
    };
  }

  private async buildFollowMeta(
    context?: FollowContext,
  ): Promise<FollowMeta | null> {
    if (!context) {
      return null;
    }

    const isFollowed = await this.followsService.isEntityFollowed({
      userId: context.userId,
      installationId: context.installationId,
      entityType: context.entityType,
      entityId: context.entityId,
    });

    return {
      isFollowed,
      entityType: context.entityType,
      entityId: context.entityId,
    };
  }

  private findTeamStandingRow(
    standingsData: unknown,
    teamId: string,
  ): StandingRow | null {
    const response = (
      standingsData as ApiFootballWrapped<StandingLeagueBlock> | null
    )?.response;

    const rows = response?.[0]?.league?.standings?.flat() ?? [];

    return (
      rows.find((row) => {
        return String(row.team?.id) === teamId;
      }) ?? null
    );
  }

  private buildRecentFormText(
    matchesData: unknown,
    teamId: string,
  ): string | null {
    const fixtures =
      (matchesData as ApiFootballWrapped<FixtureItem>).response ?? [];

    if (!fixtures.length) {
      return null;
    }

    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const fixture of fixtures) {
      const homeId = String(fixture.teams?.home?.id);
      const awayId = String(fixture.teams?.away?.id);
      const homeGoals = fixture.goals?.home;
      const awayGoals = fixture.goals?.away;

      if (homeGoals === null || homeGoals === undefined) {
        continue;
      }

      if (awayGoals === null || awayGoals === undefined) {
        continue;
      }

      if (homeGoals === awayGoals) {
        draws += 1;
        continue;
      }

      const teamIsHome = homeId === teamId;
      const teamWon =
        (teamIsHome && homeGoals > awayGoals) ||
        (!teamIsHome && awayId === teamId && awayGoals > homeGoals);

      if (teamWon) {
        wins += 1;
      } else {
        losses += 1;
      }
    }

    return `In their recent matches, the team recorded ${wins} wins, ${draws} draws, and ${losses} losses.`;
  }

  private getTopPlayerNames(playersData: unknown, limit: number): string[] {
    const players = (playersData as ApiFootballWrapped<PlayerStatsItem> | null)
      ?.response;

    if (!players?.length) {
      return [];
    }

    return players
      .map((item) => {
        const stats = item.statistics?.[0];
        const rating = Number(stats?.games?.rating ?? 0);
        const goals = stats?.goals?.total ?? 0;
        const assists = stats?.goals?.assists ?? 0;

        return {
          name: item.player?.name,
          score: rating * 10 + goals * 2 + assists,
        };
      })
      .filter((item): item is { name: string; score: number } => {
        return Boolean(item.name);
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => item.name);
  }

  private getCoachName(coachData: unknown): string | null {
    const coach = (coachData as ApiFootballWrapped<{ name?: string }>)
      .response?.[0];

    return coach?.name ?? null;
  }

  private getLeagueNames(leaguesData: unknown, limit: number): string[] {
    const leagues =
      (leaguesData as ApiFootballWrapped<{ league?: { name?: string } }>)
        .response ?? [];

    return leagues
      .map((item) => item.league?.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, limit);
  }

  private buildHeadToHeadSummary(
    h2hData: unknown,
    homeTeamName: string,
    awayTeamName: string,
  ): string | null {
    const fixtures = (h2hData as ApiFootballWrapped<FixtureItem> | null)
      ?.response;

    if (!fixtures?.length) {
      return null;
    }

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    for (const fixture of fixtures) {
      const homeGoals = fixture.goals?.home;
      const awayGoals = fixture.goals?.away;

      if (homeGoals === null || homeGoals === undefined) {
        continue;
      }

      if (awayGoals === null || awayGoals === undefined) {
        continue;
      }

      if (homeGoals === awayGoals) {
        draws += 1;
      } else if (homeGoals > awayGoals) {
        homeWins += 1;
      } else {
        awayWins += 1;
      }
    }

    return `Across the recent head-to-head meetings, ${homeTeamName} have ${homeWins} wins, ${awayTeamName} have ${awayWins} wins, and ${draws} matches ended level.`;
  }

  private calculatePlayerTraits(
    player: PlayerStatsItem,
    leaguePlayers: PlayerStatsItem[],
  ) {
    const playerStats = player.statistics?.[0];
    const metrics = this.buildPlayerTraitMetrics(playerStats);

    return [
      {
        key: 'defensiveContribution',
        label: 'DEFENSIVE CONTRIB.',
        score: this.normalizeScore(metrics.defensiveContributionPer90, 4),
        rawValue: metrics.defensiveContributionPer90,
        sourceMetric: 'tackles + interceptions per 90',
      },
      {
        key: 'goals',
        label: 'GOALS',
        score: this.normalizeScore(metrics.goalsPer90, 0.8),
        rawValue: metrics.goalsPer90,
        sourceMetric: 'goals per 90',
      },
      {
        key: 'shotAttempts',
        label: 'SHOT ATTEMPTS',
        score: this.normalizeScore(metrics.shotsPer90, 4),
        rawValue: metrics.shotsPer90,
        sourceMetric: 'shots.total per 90',
      },
      {
        key: 'touches',
        label: 'TOUCHES',
        score: this.normalizeScore(metrics.touchesPer90, 70),
        rawValue: metrics.touchesPer90,
        sourceMetric: 'passes.total per 90 proxy',
      },
      {
        key: 'chancesCreated',
        label: 'CHANCES CREATED',
        score: this.normalizeScore(metrics.chancesCreatedPer90, 3),
        rawValue: metrics.chancesCreatedPer90,
        sourceMetric: 'assists + key passes per 90',
      },
      {
        key: 'aerialWon',
        label: 'AERIAL WON',
        score: this.normalizeScore(metrics.aerialWonPer90, 5),
        rawValue: metrics.aerialWonPer90,
        sourceMetric: 'duels.won per 90 proxy',
      },
    ];
  }

  private buildPlayerTraitMetrics(statistics?: PlayerStatistic) {
    const minutes = statistics?.games?.minutes ?? 0;
    const per90Base = minutes > 0 ? minutes / 90 : 1;

    const goals = statistics?.goals?.total ?? 0;
    const assists = statistics?.goals?.assists ?? 0;
    const keyPasses = statistics?.passes?.key ?? 0;
    const shots = statistics?.shots?.total ?? 0;
    const passes = statistics?.passes?.total ?? 0;
    const tackles = statistics?.tackles?.total ?? 0;
    const interceptions = statistics?.tackles?.interceptions ?? 0;
    const duelsWon = statistics?.duels?.won ?? 0;

    return {
      defensiveContributionPer90: this.roundToOne(
        (tackles + interceptions) / per90Base,
      ),
      goalsPer90: this.roundToOne(goals / per90Base),
      shotsPer90: this.roundToOne(shots / per90Base),
      touchesPer90: this.roundToOne(passes / per90Base),
      chancesCreatedPer90: this.roundToOne((assists + keyPasses) / per90Base),
      aerialWonPer90: this.roundToOne(duelsWon / per90Base),
    };
  }

  private normalizeScore(value: number, eliteBenchmark: number): number {
    if (eliteBenchmark <= 0) {
      return 0;
    }

    return Math.min(Math.round((value / eliteBenchmark) * 100), 100);
  }

  private roundToOne(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private buildPlayerTraitsSummary(
    player: PlayerStatsItem,
    traits: Array<{
      key: string;
      label: string;
      score: number;
      rawValue: number;
      sourceMetric: string;
    }>,
  ): string {
    const playerName = player.player?.name ?? 'This player';
    const nationality = player.player?.nationality;
    const position = player.player?.position;

    const bestTrait = [...traits].sort((left, right) => {
      return right.score - left.score;
    })[0];

    let summary = `${playerName}`;

    if (nationality) {
      summary += ` from ${nationality}`;
    }

    if (position) {
      summary += ` is listed as a ${position}`;
    }

    summary += '.';

    if (bestTrait) {
      summary += ` Their strongest current trait is ${bestTrait.label.toLowerCase()}, rated at ${bestTrait.score}% compared with players in the selected league.`;
    }

    return summary;
  }

  private joinNames(names: string[]): string {
    if (names.length === 1) {
      return names[0];
    }

    if (names.length === 2) {
      return `${names[0]} and ${names[1]}`;
    }

    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  private parseNumberList(value: string): number[] {
    return [
      ...new Set(
        value
          .split('-')
          .map((item) => Number(item))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
  }

  private sortLeagueProfilesByIds(
    leagues: LeagueProfileItem[],
    ids: number[],
  ): LeagueProfileItem[] {
    const orderMap = new Map(
      ids.map((id, index): [number, number] => [id, index]),
    );

    return [...leagues].sort((left, right) => {
      const leftOrder = orderMap.get(left.league?.id ?? 0) ?? ids.length;
      const rightOrder = orderMap.get(right.league?.id ?? 0) ?? ids.length;

      return leftOrder - rightOrder;
    });
  }

  private buildLeagueListResponse(
    leagues: LeagueProfileItem[],
    ids: number[],
    query: FootballCompositeQueryDto | FootballLeaguesByIdsQueryDto,
  ) {
    const sortedLeagues = this.sortLeagueProfilesByIds(leagues, ids);
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 20);
    const totalItems = sortedLeagues.length;
    const startIndex = (page - 1) * limit;
    const response = sortedLeagues.slice(startIndex, startIndex + limit);

    return {
      get: 'leagues',
      parameters: {
        ids: ids.join('-'),
        ...(query.season ? { season: query.season } : {}),
        ...(query.current ? { current: query.current } : {}),
      },
      errors: [],
      results: response.length,
      paging: {
        current: 1,
        total: 1,
      },
      response,
      backendPaging: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  private async getLeagueProfilesByIds(
    query: FootballLeaguesByIdsQueryDto,
  ): Promise<LeagueProfileItem[]> {
    const ids = this.parseNumberList(query.ids);
    const leagueMap = new Map<number, LeagueProfileItem>();

    const leagueResponses = await Promise.all(
      ids.map((id) => {
        return this.footballService.getLeagues({
          id: String(id),
          season: query.season,
          current: query.current,
        });
      }),
    );

    for (const leagueResponse of leagueResponses) {
      const leagues =
        (leagueResponse as ApiFootballWrapped<LeagueProfileItem>).response ??
        [];

      for (const league of leagues) {
        const leagueId = league.league?.id;

        if (leagueId) {
          leagueMap.set(leagueId, league);
        }
      }
    }

    return this.sortLeagueProfilesByIds(Array.from(leagueMap.values()), ids);
  }

  async getTopLeagues(query: FootballCompositeQueryDto) {
    const ids = this.parseNumberList(TOP_LEAGUE_IDS_PARAM);
    const leagues = await this.getLeagueProfilesByIds({
      ids: TOP_LEAGUE_IDS_PARAM,
      season: query.season,
      current: undefined,
      page: query.page,
      limit: query.limit,
    });

    return this.buildLeagueListResponse(leagues, ids, {
      ids: TOP_LEAGUE_IDS_PARAM,
      season: query.season,
      page: query.page,
      limit: query.limit,
    });
  }

  async getLeaguesByIds(query: FootballLeaguesByIdsQueryDto) {
    const ids = this.parseNumberList(query.ids);
    const leagues = await this.getLeagueProfilesByIds(query);

    return this.buildLeagueListResponse(leagues, ids, query);
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

  async getMatchAbout(fixtureId: string, followContext?: FollowContext) {
    const fixtureData = await this.footballService.getFixtureById(fixtureId);

    const fixture = (fixtureData as ApiFootballWrapped<FixtureItem>)
      .response?.[0];

    if (!fixture) {
      return this.withFollowMeta(
        {
          fixtureId,
          about: 'Match information is not available yet.',
        },
        followContext,
      );
    }

    const homeTeam = fixture.teams?.home;
    const awayTeam = fixture.teams?.away;
    const homeTeamName = homeTeam?.name ?? 'Home team';
    const awayTeamName = awayTeam?.name ?? 'Away team';
    const leagueName = fixture.league?.name;
    const round = fixture.league?.round;
    const venueName = fixture.fixture?.venue?.name;
    const venueCity = fixture.fixture?.venue?.city;
    const statusLong = fixture.fixture?.status?.long;
    const statusShort = fixture.fixture?.status?.short;
    const homeGoals = fixture.goals?.home;
    const awayGoals = fixture.goals?.away;

    const h2h =
      homeTeam?.id && awayTeam?.id
        ? await this.footballService.getHeadToHead({
            h2h: `${homeTeam.id}-${awayTeam.id}`,
            last: '5',
          })
        : null;

    const aboutParts: string[] = [];

    let intro = `${homeTeamName} face ${awayTeamName}`;

    if (leagueName) {
      intro += ` in ${leagueName}`;
    }

    if (round) {
      intro += `, ${round}`;
    }

    intro += '.';

    aboutParts.push(intro);

    if (venueName) {
      let venueText = `The match is being played at ${venueName}`;

      if (venueCity) {
        venueText += ` in ${venueCity}`;
      }

      venueText += '.';

      aboutParts.push(venueText);
    }

    if (statusShort && statusShort !== 'NS' && statusLong) {
      const scoreText =
        homeGoals !== null &&
        homeGoals !== undefined &&
        awayGoals !== null &&
        awayGoals !== undefined
          ? ` with the score at ${homeTeamName} ${homeGoals}-${awayGoals} ${awayTeamName}`
          : '';

      aboutParts.push(`The current match status is ${statusLong}${scoreText}.`);
    }

    const h2hSummary = this.buildHeadToHeadSummary(
      h2h,
      homeTeamName,
      awayTeamName,
    );

    if (h2hSummary) {
      aboutParts.push(h2hSummary);
    }

    return this.withFollowMeta(
      {
        fixtureId,
        about: aboutParts.join(' '),
      },
      followContext,
    );
  }

  async getKnockoutBracket(
    fixtureId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    if (!query.league || !query.season) {
      return this.withFollowMeta(
        {
          fixtureId,
          rounds: [],
          message: 'league and season are required',
        },
        followContext,
      );
    }

    const leagueId = String(query.league);

    const data =
      leagueId === '1'
        ? await this.getWorldCupKnockoutBracket(fixtureId, query)
        : await this.getGenericKnockoutBracket(fixtureId, query);

    return this.withFollowMeta(data, followContext);
  }

  private async getWorldCupKnockoutBracket(
    fixtureId: string,
    query: FootballCompositeQueryDto,
  ) {
    const worldCupRounds = [
      'Round of 16',
      'Quarter-finals',
      'Semi-finals',
      '3rd Place Final',
      'Final',
    ];

    const bracketRounds = await Promise.all(
      worldCupRounds.map(async (roundName) => {
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
      competition: 'World Cup',
      rounds: bracketRounds,
    };
  }

  private async getGenericKnockoutBracket(
    fixtureId: string,
    query: FootballCompositeQueryDto,
  ) {
    const rounds = (await this.footballService.getFixtureRounds({
      league: query.league,
      season: query.season,
    })) as ApiFootballWrapped<string>;

    const roundNames = rounds.response ?? [];

    const knockoutRoundNames = roundNames.filter((roundName) => {
      return this.isKnockoutRound(roundName);
    });

    const bracketRounds = await Promise.all(
      knockoutRoundNames.map(async (roundName) => {
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

  private isKnockoutRound(roundName: string): boolean {
    const normalizedRound = roundName.toLowerCase();

    return [
      'round of 16',
      'quarter',
      'semi',
      'final',
      '3rd place',
      'third place',
      'play-offs',
      'playoffs',
    ].some((keyword) => normalizedRound.includes(keyword));
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

  async getTeamOverview(
    teamId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    const [
      team,
      nextMatch,
      lastMatches,
      leagues,
      standings,
      squad,
      coach,
      follow,
    ] = await Promise.all([
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
      this.buildFollowMeta(followContext),
    ]);

    return {
      teamId,
      follow,
      team,
      nextMatch,
      lastMatches,
      leagues,
      standings,
      squad,
      coach,
    };
  }

  async getTeamTopPlayers(
    teamId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
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

    const result = this.paginateArray(sorted, query.page, query.limit);

    return this.withFollowMeta(result, followContext);
  }

  async getTeamAbout(
    teamId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    const [teamData, lastMatchesData, leaguesData, squadData, coachData] =
      await Promise.all([
        this.footballService.getTeams({ id: teamId }),
        this.footballService.getTeamFixtures(teamId, { last: '6' }),
        this.footballService.getLeagues({
          team: teamId,
          season: query.season,
        }),
        this.footballService.getPlayerSquads({ team: teamId }),
        this.footballService.getCoaches({ team: teamId }),
      ]);

    const standingsData =
      query.league && query.season
        ? await this.footballService.getStandings({
            league: query.league,
            season: query.season,
          })
        : null;

    const playerStatsData = query.season
      ? await this.footballService.getPlayers({
          team: teamId,
          season: query.season,
          page: '1',
          limit: '50',
        })
      : null;

    const teamProfile = (teamData as ApiFootballWrapped<TeamProfileItem>)
      .response?.[0];

    const teamName = teamProfile?.team?.name ?? 'This team';
    const country = teamProfile?.team?.country;
    const venueName = teamProfile?.venue?.name;
    const venueCity = teamProfile?.venue?.city;
    const venueCapacity = teamProfile?.venue?.capacity;
    const venueSurface = teamProfile?.venue?.surface;

    const standingRow = this.findTeamStandingRow(standingsData, teamId);
    const recentForm = this.buildRecentFormText(lastMatchesData, teamId);
    const topPlayers = this.getTopPlayerNames(playerStatsData, 3);
    const coachName = this.getCoachName(coachData);
    const activeLeagues = this.getLeagueNames(leaguesData, 3);

    const aboutParts: string[] = [];

    let intro = `${teamName} is a football club`;

    if (country) {
      intro += ` from ${country}`;
    }

    if (venueName) {
      intro += `, playing their home matches at ${venueName}`;
      if (venueCity) {
        intro += ` in ${venueCity}`;
      }
    }

    intro += '.';

    aboutParts.push(intro);

    if (venueCapacity || venueSurface) {
      const venueInfo: string[] = [];

      if (venueCapacity) {
        venueInfo.push(
          `the stadium capacity is ${venueCapacity.toLocaleString()}`,
        );
      }

      if (venueSurface) {
        venueInfo.push(`the playing surface is ${venueSurface}`);
      }

      aboutParts.push(`At their home ground, ${venueInfo.join(' and ')}.`);
    }

    if (standingRow) {
      const rankText = standingRow.rank
        ? `ranked ${standingRow.rank}`
        : 'listed in the table';

      const pointsText =
        typeof standingRow.points === 'number'
          ? ` with ${standingRow.points} points`
          : '';

      const descriptionText = standingRow.description
        ? ` Their current table zone is ${standingRow.description}.`
        : '';

      aboutParts.push(
        `${teamName} are currently ${rankText}${pointsText}.${descriptionText}`,
      );
    }

    if (recentForm) {
      aboutParts.push(recentForm);
    }

    if (topPlayers.length > 0) {
      aboutParts.push(
        `Key players in the current season include ${this.joinNames(topPlayers)}.`,
      );
    }

    if (coachName) {
      aboutParts.push(`The team is currently managed by ${coachName}.`);
    }

    if (activeLeagues.length > 0) {
      aboutParts.push(
        `${teamName} are active in ${this.joinNames(activeLeagues)}.`,
      );
    }

    return {
      teamId,
      about: aboutParts.join(' '),
      followContext,
      // source: {
      //   team: teamData,
      //   lastMatches: lastMatchesData,
      //   standings: standingsData,
      //   leagues: leaguesData,
      //   squad: squadData,
      //   coach: coachData,
      //   playerStats: playerStatsData,
      // },
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
    followContext?: FollowContext,
  ) {
    if (!query.team) {
      return this.withFollowMeta(
        {
          playerId,
          items: [],
          message: 'team is required to fetch recent player matches',
        },
        followContext,
      );
    }

    const fixtures = await this.footballService.getTeamFixtures(query.team, {
      last: query.last ?? '10',
      page: query.page,
      limit: query.limit,
    });

    return this.withFollowMeta(
      {
        playerId,
        teamId: query.team,
        fixtures,
      },
      followContext,
    );
  }

  async getPlayerCareerTotals(
    playerId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
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

    return this.withFollowMeta(
      this.paginateArray(rows, query.page, query.limit),
      followContext,
    );
  }

  async getPlayerTraits(
    playerId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    if (!query.league || !query.season) {
      return this.withFollowMeta(
        {
          playerId,
          traits: null,
          about: null,
          message: 'league and season are required',
        },
        followContext,
      );
    }

    const [playerData, leaguePlayersData] = await Promise.all([
      this.footballService.getPlayers({
        id: playerId,
        season: query.season,
      }),
      this.footballService.getPlayers({
        league: query.league,
        season: query.season,
        page: '1',
        limit: '500',
      }),
    ]);

    const player = (playerData as ApiFootballWrapped<PlayerStatsItem>)
      .response?.[0];

    const leaguePlayers =
      (leaguePlayersData as ApiFootballWrapped<PlayerStatsItem>).response ?? [];

    if (!player) {
      return this.withFollowMeta(
        {
          playerId,
          traits: null,
          about: 'Player data is not available for this season.',
        },
        followContext,
      );
    }

    const traits = this.calculatePlayerTraits(player, leaguePlayers);
    const about = this.buildPlayerTraitsSummary(player, traits);

    return this.withFollowMeta(
      {
        playerId,
        about,
        traits,
      },
      followContext,
    );
  }

  async getGroupedPlayerTrophies(
    playerId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    const trophies = (await this.footballService.getTrophies({
      player: playerId,
    })) as ApiFootballWrapped<any>;

    return this.withFollowMeta(
      this.groupTrophies(trophies.response ?? [], query.page, query.limit),
      followContext,
    );
  }

  async getGroupedCoachTrophies(
    coachId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    const trophies = (await this.footballService.getTrophies({
      coach: coachId,
    })) as ApiFootballWrapped<any>;

    return this.withFollowMeta(
      this.groupTrophies(trophies.response ?? [], query.page, query.limit),
      followContext,
    );
  }

  async getCoachCurrentRecord(
    coachId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    if (!query.team || !query.from || !query.to) {
      return this.withFollowMeta(
        {
          coachId,
          record: null,
          message: 'team, from, and to are required',
        },
        followContext,
      );
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

    return this.withFollowMeta(
      {
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
      },
      followContext,
    );
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

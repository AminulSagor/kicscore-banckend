import { Injectable } from '@nestjs/common';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FollowsService } from 'src/modules/follows/follows.service';
import { FootballCompositeQueryDto } from './dto/football-composite-query.dto';
import { FootballService } from './football.service';
import {
  ApiFootballArrayResponse,
  ApiFootballObjectResponse,
  FixtureEventsResponse,
  FixtureItem,
  FixturePlayersResponse,
  LeagueTeamItem,
  PlayerMatchEvent,
  PlayerRecentMatchItem,
  PlayerStatsItem,
  StandingLeagueBlock,
  StandingResponseItem,
  StandingRow,
  TeamAggregatedPlayerStats,
  TeamLeagueItem,
  TeamProfileItem,
  TeamStatisticsItem,
  TeamStatsSection,
  TeamTrophyPreviewGroupInput,
} from 'src/common/interfaces/api-football-custom-response.interface';
import { FollowContext } from 'src/modules/follows/types/follow-context.type';
import { TOP_LEAGUE_IDS_PARAM } from 'src/common/constants/top-league-ids.constant';
import { FootballLeaguesByIdsQueryDto } from './dto/football-leagues-by-ids-query.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { TeamTrophyPreviewGroup } from './entities/team-trophy-preview-group.entity';
import { Repository } from 'typeorm';
import {
  TeamTrophyHonourType,
  TeamTrophyPreviewSeason,
} from './entities/team-trophy-preview-season.entity';
import { TeamTrophyPreviewTarget } from './entities/team-trophy-preview-target.entity';
import {
  LeaguePlayerStatsCategory,
  LeaguePlayerStatsQueryDto,
} from './dto/league-player-stats-query.dto';
import {
  LeagueTeamStatsCategory,
  LeagueTeamStatsQueryDto,
} from './dto/league-team-stats-query.dto';

type PlayerStatistic = NonNullable<PlayerStatsItem['statistics']>[number];

type FollowMeta = {
  isFollowed: boolean;
  entityType: FollowEntityType;
  entityId: string;
};

type TeamHonourType = 'WINNER' | 'RUNNER_UP';

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

    @InjectRepository(TeamTrophyPreviewTarget)
    private readonly teamTrophyTargetRepository: Repository<TeamTrophyPreviewTarget>,

    @InjectRepository(TeamTrophyPreviewGroup)
    private readonly teamTrophyGroupRepository: Repository<TeamTrophyPreviewGroup>,

    @InjectRepository(TeamTrophyPreviewSeason)
    private readonly teamTrophySeasonRepository: Repository<TeamTrophyPreviewSeason>,
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
    const target = await this.ensureTeamTrophyTarget(teamId);
    const existingCount = await this.teamTrophyGroupRepository.count({
      where: { teamId },
    });

    if (!target.initialSyncCompleted || existingCount === 0) {
      await this.syncTeamTrophyPreviewTarget(teamId, {
        forceInitial: true,
      });
    }

    return this.getTeamTrophyPreviewFromDb(teamId, query);
  }

  private async getTeamTrophyPreviewFromDb(
    teamId: string,
    query: FootballCompositeQueryDto,
  ) {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 20);

    const [groups, total] = await this.teamTrophyGroupRepository.findAndCount({
      where: {
        teamId,
      },
      relations: {
        seasons: true,
      },
      order: {
        leagueName: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const target = await this.teamTrophyTargetRepository.findOne({
      where: {
        teamId,
      },
    });

    return {
      teamId,
      syncStatus: {
        initialSyncCompleted: target?.initialSyncCompleted ?? false,
        syncInProgress: target?.syncInProgress ?? false,
        syncStartedAt: target?.syncStartedAt ?? null,
        lastSyncedFromSeason: target?.lastSyncedFromSeason ?? null,
        lastSyncedToSeason: target?.lastSyncedToSeason ?? null,
        lastSyncedAt: target?.lastSyncedAt ?? null,
        lastError: target?.lastError ?? null,
      },
      items: groups.map((group) => {
        const winnerSeasons = group.seasons
          .filter((season) => season.honourType === TeamTrophyHonourType.WINNER)
          .map((season) => String(season.season))
          .sort();

        const runnerUpSeasons = group.seasons
          .filter(
            (season) => season.honourType === TeamTrophyHonourType.RUNNER_UP,
          )
          .map((season) => String(season.season))
          .sort();

        return {
          league: {
            id: group.leagueId,
            name: group.leagueName,
            type: group.leagueType,
            logo: group.leagueLogo,
            country: group.country,
            flag: group.flag,
          },
          winner: {
            count: group.winnerCount,
            seasons: winnerSeasons,
          },
          runnerUp: {
            count: group.runnerUpCount,
            seasons: runnerUpSeasons,
          },
          lastSyncedAt: group.lastSyncedAt,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async ensureTeamTrophyTarget(
    teamId: string,
  ): Promise<TeamTrophyPreviewTarget> {
    const existingTarget = await this.teamTrophyTargetRepository.findOne({
      where: {
        teamId,
      },
    });

    if (existingTarget) {
      return existingTarget;
    }

    return this.teamTrophyTargetRepository.save(
      this.teamTrophyTargetRepository.create({
        teamId,
        initialSyncCompleted: false,
        syncInProgress: false,
        syncStartedAt: null,
        lastSyncedFromSeason: null,
        lastSyncedToSeason: null,
        lastSyncedAt: null,
        lastError: null,
      }),
    );
  }

  async syncTeamTrophyPreviewTarget(
    teamId: string,
    options?: {
      forceInitial?: boolean;
    },
  ): Promise<{
    teamId: string;
    fromSeason: number;
    toSeason: number;
    groupsSynced: number;
  }> {
    const target = await this.ensureTeamTrophyTarget(teamId);

    if (target.syncInProgress && !this.canRestartTrophySync(target)) {
      return {
        teamId,
        fromSeason: target.lastSyncedFromSeason ?? 0,
        toSeason: target.lastSyncedToSeason ?? 0,
        groupsSynced: 0,
      };
    }

    target.syncInProgress = true;
    target.syncStartedAt = new Date();
    target.lastError = null;

    await this.teamTrophyTargetRepository.save(target);

    const currentYear = new Date().getFullYear();

    const fromSeason =
      !target.initialSyncCompleted || options?.forceInitial
        ? this.getInitialTrophyFromSeason()
        : Math.max(2000, currentYear - this.getRecentTrophyYears());

    const toSeason = currentYear;

    const honoursMap = new Map<string, TeamTrophyPreviewGroupInput>();

    try {
      for (let season = fromSeason; season <= toSeason; season += 1) {
        const leaguesResponse = (await this.footballService.getLeagues({
          team: teamId,
          season,
        })) as ApiFootballWrapped<TeamLeagueItem>;

        const leagues = leaguesResponse.response ?? [];

        for (const leagueItem of leagues) {
          const honourType =
            leagueItem.league?.type === 'Cup'
              ? await this.resolveCupHonour(teamId, leagueItem, season)
              : await this.resolveLeagueHonour(teamId, leagueItem, season);

          if (!honourType) {
            continue;
          }

          this.addTeamHonourToInputMap({
            honoursMap,
            leagueItem,
            season,
            honourType,
          });
        }
      }

      await this.saveTeamTrophyPreviewGroups(teamId, honoursMap);

      target.initialSyncCompleted = true;
      target.syncInProgress = false;
      target.syncStartedAt = null;
      target.lastSyncedFromSeason = fromSeason;
      target.lastSyncedToSeason = toSeason;
      target.lastSyncedAt = new Date();
      target.lastError = null;

      await this.teamTrophyTargetRepository.save(target);

      return {
        teamId,
        fromSeason,
        toSeason,
        groupsSynced: honoursMap.size,
      };
    } catch (error) {
      target.syncInProgress = false;
      target.syncStartedAt = null;
      target.lastError = error instanceof Error ? error.message : String(error);
      target.lastSyncedAt = new Date();

      await this.teamTrophyTargetRepository.save(target);

      throw error;
    }
  }

  private canRestartTrophySync(target: TeamTrophyPreviewTarget): boolean {
    if (!target.syncStartedAt) {
      return true;
    }

    const maxSyncAgeMs = 60 * 60 * 1000;
    const syncAgeMs = Date.now() - target.syncStartedAt.getTime();

    return syncAgeMs > maxSyncAgeMs;
  }

  private getInitialTrophyFromSeason(): number {
    const rawValue = process.env.TEAM_TROPHY_PREVIEW_FROM_SEASON;
    const parsedValue = Number(rawValue ?? 2000);

    if (Number.isNaN(parsedValue) || parsedValue < 1950) {
      return 2000;
    }

    return parsedValue;
  }

  private getRecentTrophyYears(): number {
    const rawValue = process.env.TEAM_TROPHY_PREVIEW_RECENT_YEARS;
    const parsedValue = Number(rawValue ?? 2);

    if (Number.isNaN(parsedValue) || parsedValue < 1) {
      return 2;
    }

    return parsedValue;
  }

  async refreshTeamTrophiesPreview(params: {
    teamId: string;
    fromSeason: number;
    toSeason: number;
  }): Promise<{
    teamId: string;
    fromSeason: number;
    toSeason: number;
    groupsSynced: number;
  }> {
    const honoursMap = new Map<string, TeamTrophyPreviewGroupInput>();

    for (
      let season = params.fromSeason;
      season <= params.toSeason;
      season += 1
    ) {
      const leaguesResponse = (await this.footballService.getLeagues({
        team: params.teamId,
        season,
      })) as ApiFootballWrapped<TeamLeagueItem>;

      const leagues = leaguesResponse.response ?? [];

      for (const leagueItem of leagues) {
        const honourType =
          leagueItem.league?.type === 'Cup'
            ? await this.resolveCupHonour(params.teamId, leagueItem, season)
            : await this.resolveLeagueHonour(params.teamId, leagueItem, season);

        if (!honourType) {
          continue;
        }

        this.addTeamHonourToInputMap({
          honoursMap,
          leagueItem,
          season,
          honourType,
        });
      }
    }

    await this.saveTeamTrophyPreviewGroups(params.teamId, honoursMap);

    return {
      teamId: params.teamId,
      fromSeason: params.fromSeason,
      toSeason: params.toSeason,
      groupsSynced: honoursMap.size,
    };
  }

  private addTeamHonourToInputMap(params: {
    honoursMap: Map<string, TeamTrophyPreviewGroupInput>;
    leagueItem: TeamLeagueItem;
    season: number;
    honourType: TeamHonourType;
  }): void {
    const key = String(params.leagueItem.league.id);

    const existing = params.honoursMap.get(key) ?? {
      league: {
        id: params.leagueItem.league.id,
        name: params.leagueItem.league.name,
        type: params.leagueItem.league.type,
        logo: params.leagueItem.league.logo ?? null,
        country: params.leagueItem.country.name,
        flag: params.leagueItem.country.flag ?? null,
      },
      winnerSeasons: [],
      runnerUpSeasons: [],
    };

    if (params.honourType === 'WINNER') {
      existing.winnerSeasons.push(params.season);
    }

    if (params.honourType === 'RUNNER_UP') {
      existing.runnerUpSeasons.push(params.season);
    }

    params.honoursMap.set(key, existing);
  }

  private async saveTeamTrophyPreviewGroups(
    teamId: string,
    honoursMap: Map<string, TeamTrophyPreviewGroupInput>,
  ): Promise<void> {
    for (const item of honoursMap.values()) {
      let group = await this.teamTrophyGroupRepository.findOne({
        where: {
          teamId,
          leagueId: item.league.id,
        },
      });

      if (!group) {
        group = this.teamTrophyGroupRepository.create({
          teamId,
          leagueId: item.league.id,
          leagueName: item.league.name,
          leagueType: item.league.type,
          leagueLogo: item.league.logo,
          country: item.league.country,
          flag: item.league.flag,
          winnerCount: item.winnerSeasons.length,
          runnerUpCount: item.runnerUpSeasons.length,
          lastSyncedAt: new Date(),
        });
      } else {
        group.leagueName = item.league.name;
        group.leagueType = item.league.type;
        group.leagueLogo = item.league.logo;
        group.country = item.league.country;
        group.flag = item.league.flag;
        group.winnerCount = item.winnerSeasons.length;
        group.runnerUpCount = item.runnerUpSeasons.length;
        group.lastSyncedAt = new Date();
      }

      const savedGroup = await this.teamTrophyGroupRepository.save(group);

      await this.teamTrophySeasonRepository.delete({
        groupId: savedGroup.id,
      });

      const seasons = [
        ...item.winnerSeasons.map((season) =>
          this.teamTrophySeasonRepository.create({
            groupId: savedGroup.id,
            honourType: TeamTrophyHonourType.WINNER,
            season,
          }),
        ),
        ...item.runnerUpSeasons.map((season) =>
          this.teamTrophySeasonRepository.create({
            groupId: savedGroup.id,
            honourType: TeamTrophyHonourType.RUNNER_UP,
            season,
          }),
        ),
      ];

      if (seasons.length > 0) {
        await this.teamTrophySeasonRepository.save(seasons);
      }
    }
  }

  private async resolveLeagueHonour(
    teamId: string,
    leagueItem: TeamLeagueItem,
    season: number,
  ): Promise<TeamHonourType | null> {
    const hasStandings = leagueItem.seasons?.some((seasonItem) => {
      return seasonItem.year === season && seasonItem.coverage?.standings;
    });

    if (!hasStandings) {
      return null;
    }

    const standingsResponse = (await this.footballService.getStandings({
      league: String(leagueItem.league.id),
      season,
    })) as ApiFootballWrapped<StandingResponseItem>;

    const rows =
      standingsResponse.response?.[0]?.league?.standings?.flat() ?? [];

    const teamRow = rows.find((row) => {
      return String(row.team?.id) === teamId;
    });

    if (!teamRow?.rank) {
      return null;
    }

    if (teamRow.rank === 1) {
      return 'WINNER';
    }

    if (teamRow.rank === 2) {
      return 'RUNNER_UP';
    }

    return null;
  }

  private async resolveCupHonour(
    teamId: string,
    leagueItem: TeamLeagueItem,
    season: number,
  ): Promise<TeamHonourType | null> {
    const fixturesResponse = (await this.footballService.getFixtures({
      league: String(leagueItem.league.id),
      season,
    })) as ApiFootballWrapped<FixtureItem>;

    const fixtures = fixturesResponse.response ?? [];

    const finalFixtures = fixtures
      .filter((fixture) => {
        const round = fixture.league?.round ?? '';
        const status = fixture.fixture?.status?.short ?? '';

        const homeTeamId = String(fixture.teams?.home?.id ?? '');
        const awayTeamId = String(fixture.teams?.away?.id ?? '');

        const teamPlayed = homeTeamId === teamId || awayTeamId === teamId;
        const isFinished = ['FT', 'AET', 'PEN'].includes(status);

        return this.isCupFinalRound(round) && teamPlayed && isFinished;
      })
      .sort((left, right) => {
        return this.getFixtureTimestamp(right) - this.getFixtureTimestamp(left);
      });

    const finalFixture = finalFixtures[0];

    if (!finalFixture) {
      return null;
    }

    const homeTeamId = String(finalFixture.teams?.home?.id ?? '');
    const awayTeamId = String(finalFixture.teams?.away?.id ?? '');

    if (homeTeamId === teamId) {
      return finalFixture.teams?.home?.winner ? 'WINNER' : 'RUNNER_UP';
    }

    if (awayTeamId === teamId) {
      return finalFixture.teams?.away?.winner ? 'WINNER' : 'RUNNER_UP';
    }

    return null;
  }

  private isCupFinalRound(round: string): boolean {
    const normalizedRound = round.toLowerCase();

    if (normalizedRound.includes('semi')) {
      return false;
    }

    if (normalizedRound.includes('quarter')) {
      return false;
    }

    if (normalizedRound.includes('round of')) {
      return false;
    }

    if (normalizedRound.includes('3rd place')) {
      return false;
    }

    if (normalizedRound.includes('third place')) {
      return false;
    }

    return normalizedRound.includes('final');
  }

  async getPlayerRecentMatches(
    playerId: string,
    query: FootballCompositeQueryDto,
    followContext?: FollowContext,
  ) {
    if (!query.season) {
      return this.withFollowMeta(
        {
          playerId,
          items: [],
          meta: {
            page: this.toPositiveNumber(query.page, 1),
            limit: this.toPositiveNumber(query.limit, 10),
            total: 0,
            totalPages: 0,
          },
          message: 'season is required to fetch recent player matches',
        },
        followContext,
      );
    }

    const playerData = (await this.footballService.getPlayers({
      id: playerId,
      season: query.season,
    })) as ApiFootballWrapped<PlayerStatsItem>;

    const teamIds = this.getPlayerContextTeamIds(playerData, query.team);

    if (!teamIds.length) {
      return this.withFollowMeta(
        {
          playerId,
          season: query.season,
          items: [],
          meta: {
            page: this.toPositiveNumber(query.page, 1),
            limit: this.toPositiveNumber(query.limit, 10),
            total: 0,
            totalPages: 0,
          },
          message: 'No team context found for this player and season',
        },
        followContext,
      );
    }

    const last = query.last ?? '10';
    const fixtureMap = new Map<string, FixtureItem>();

    for (const teamId of teamIds) {
      const fixturesResponse = (await this.footballService.getTeamFixtures(
        teamId,
        {
          last,
        },
      )) as ApiFootballWrapped<FixtureItem>;

      for (const fixture of fixturesResponse.response ?? []) {
        const fixtureId = fixture.fixture?.id;

        if (fixtureId) {
          fixtureMap.set(String(fixtureId), fixture);
        }
      }
    }

    const candidateFixtures = Array.from(fixtureMap.values()).sort(
      (left, right) => {
        return this.getFixtureTimestamp(right) - this.getFixtureTimestamp(left);
      },
    );

    const appearedMatches: PlayerRecentMatchItem[] = [];

    for (const fixture of candidateFixtures) {
      const fixtureId = fixture.fixture?.id;

      if (!fixtureId) {
        continue;
      }

      const [fixturePlayersData, fixtureEventsData] = await Promise.all([
        this.footballService.getFixturePlayers(String(fixtureId)),
        this.footballService.getFixtureEvents(String(fixtureId)),
      ]);

      const playerMatchStats = this.extractPlayerMatchStats({
        playerId,
        fixturePlayersData,
      });

      if (!playerMatchStats) {
        continue;
      }

      const eventSummary = this.extractPlayerMatchEvents({
        playerId,
        fixtureEventsData,
      });

      appearedMatches.push({
        fixtureId: String(fixtureId),
        fixture,
        player: {
          minutes: playerMatchStats.minutes,
          rating: playerMatchStats.rating,
          goals: playerMatchStats.goals,
          assists: playerMatchStats.assists,
          yellowCards: playerMatchStats.yellowCards,
          redCards: playerMatchStats.redCards,
          substitute: playerMatchStats.substitute,
          position: playerMatchStats.position,
          number: playerMatchStats.number,
          events: eventSummary.events,
          eventChips: eventSummary.eventChips,
        },
      });
    }

    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 10);
    const total = appearedMatches.length;
    const startIndex = (page - 1) * limit;

    return this.withFollowMeta(
      {
        playerId,
        season: query.season,
        teamIds,
        items: appearedMatches.slice(startIndex, startIndex + limit),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      followContext,
    );
  }

  private getFixtureTimestamp(fixture: FixtureItem): number {
    if (typeof fixture.fixture?.timestamp === 'number') {
      return fixture.fixture.timestamp;
    }

    if (!fixture.fixture?.date) {
      return 0;
    }

    const timestamp = new Date(fixture.fixture.date).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private getPlayerContextTeamIds(
    playerData: ApiFootballWrapped<PlayerStatsItem>,
    requestedTeamId?: string,
  ): string[] {
    const teamIds = new Set<string>();

    if (requestedTeamId) {
      teamIds.add(requestedTeamId);
    }

    for (const playerItem of playerData.response ?? []) {
      for (const statistic of playerItem.statistics ?? []) {
        const teamId = statistic.team?.id;

        if (teamId) {
          teamIds.add(String(teamId));
        }
      }
    }

    return Array.from(teamIds);
  }

  private extractPlayerMatchStats(params: {
    playerId: string;
    fixturePlayersData: unknown;
  }): {
    minutes: number | null;
    rating: string | null;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    substitute: boolean | null;
    position: string | null;
    number: number | null;
  } | null {
    const fixturePlayers = params.fixturePlayersData as FixturePlayersResponse;

    for (const team of fixturePlayers.response ?? []) {
      for (const playerItem of team.players ?? []) {
        if (String(playerItem.player?.id) !== params.playerId) {
          continue;
        }

        const statistics = playerItem.statistics?.[0];

        if (!statistics) {
          return null;
        }

        return {
          minutes: statistics.games?.minutes ?? null,
          rating: statistics.games?.rating ?? null,
          goals: statistics.goals?.total ?? 0,
          assists: statistics.goals?.assists ?? 0,
          yellowCards: statistics.cards?.yellow ?? 0,
          redCards: statistics.cards?.red ?? 0,
          substitute: statistics.games?.substitute ?? null,
          position: statistics.games?.position ?? null,
          number: statistics.games?.number ?? null,
        };
      }
    }

    return null;
  }

  private extractPlayerMatchEvents(params: {
    playerId: string;
    fixtureEventsData: unknown;
  }): {
    events: Array<{
      type: string;
      detail: string;
      minute: string | null;
      role: 'PLAYER' | 'ASSIST';
    }>;
    eventChips: string[];
  } {
    const fixtureEvents = params.fixtureEventsData as FixtureEventsResponse;
    const events: PlayerMatchEvent[] = [];
    const eventChips: string[] = [];

    for (const event of fixtureEvents.response ?? []) {
      const playerId = event.player?.id ? String(event.player.id) : null;
      const assistId = event.assist?.id ? String(event.assist.id) : null;
      const minute = this.formatEventMinute(
        event.time?.elapsed ?? null,
        event.time?.extra ?? null,
      );

      if (playerId === params.playerId) {
        const detail = event.detail ?? event.type ?? 'Event';
        const type = event.type ?? 'Event';

        events.push({
          type,
          detail,
          minute,
          role: 'PLAYER' as const,
        });

        eventChips.push(this.buildPlayerEventChip(type, detail, minute));
      }

      if (assistId === params.playerId) {
        const type = event.type ?? 'Event';
        const detail = 'Assist';

        events.push({
          type,
          detail,
          minute,
          role: 'ASSIST' as const,
        });

        eventChips.push(`Assist${minute ? ` ${minute}` : ''}`);
      }
    }

    return {
      events,
      eventChips: Array.from(new Set(eventChips)),
    };
  }

  private buildPlayerEventChip(
    type: string,
    detail: string,
    minute: string | null,
  ): string {
    if (type === 'Goal') {
      return `Goal${minute ? ` ${minute}` : ''}`;
    }

    if (type === 'Card') {
      return `${detail}${minute ? ` ${minute}` : ''}`;
    }

    if (type === 'subst') {
      return `Substitution${minute ? ` ${minute}` : ''}`;
    }

    return `${detail}${minute ? ` ${minute}` : ''}`;
  }

  private formatEventMinute(
    elapsed: number | null,
    extra: number | null,
  ): string | null {
    if (elapsed === null) {
      return null;
    }

    if (extra !== null && extra > 0) {
      return `${elapsed}+${extra}'`;
    }

    return `${elapsed}'`;
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

  async getLeaguePlayerStats(
    leagueId: string,
    query: LeaguePlayerStatsQueryDto,
  ): Promise<{
    leagueId: string;
    season: string;
    category: LeaguePlayerStatsCategory;
    sections: Array<{
      key: string;
      title: string;
      items: Array<{
        rank: number;
        value: number;
        player: {
          id: number | null;
          name: string | null;
          photo: string | null;
        };
        team: {
          id: number | null;
          name: string | null;
          logo: string | null;
        };
      }>;
    }>;
    meta: {
      page: number;
      limit: number;
    };
  }> {
    const players = await this.getAllLeaguePlayersForStats({
      leagueId,
      season: query.season,
    });

    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 10);

    const sections = this.buildLeaguePlayerStatSections({
      players,
      category: query.category,
      page,
      limit,
    });

    return {
      leagueId,
      season: query.season,
      category: query.category,
      sections,
      meta: {
        page,
        limit,
      },
    };
  }

  private async getAllLeaguePlayersForStats(params: {
    leagueId: string;
    season: string;
  }): Promise<PlayerStatsItem[]> {
    const firstPage = (await this.footballService.getPlayersApiPage({
      league: params.leagueId,
      season: params.season,
      page: '1',
    })) as {
      paging?: {
        current?: number;
        total?: number;
      };
      response?: PlayerStatsItem[];
    };

    const totalPages = firstPage.paging?.total ?? 1;

    const maxPages = this.toPositiveNumber(
      process.env.LEAGUE_PLAYER_STATS_MAX_API_PAGES,
      totalPages,
    );

    const pagesToFetch = Math.min(totalPages, maxPages);

    const players = [...(firstPage.response ?? [])];

    if (pagesToFetch <= 1) {
      return players;
    }

    for (let page = 2; page <= pagesToFetch; page += 1) {
      const data = (await this.footballService.getPlayersApiPage({
        league: params.leagueId,
        season: params.season,
        page: String(page),
      })) as {
        response?: PlayerStatsItem[];
      };

      players.push(...(data.response ?? []));
    }

    return players;
  }

  private buildLeaguePlayerStatSections(params: {
    players: PlayerStatsItem[];
    category: LeaguePlayerStatsCategory;
    page: number;
    limit: number;
  }) {
    const sections = this.getLeaguePlayerStatSectionDefinitions(
      params.category,
    );

    return sections.map((section) => {
      const rankedItems = params.players
        .map((player) => {
          const statistic = player.statistics?.[0];
          const value = section.getValue(statistic);

          return {
            value,
            player: {
              id: player.player?.id ?? null,
              name: player.player?.name ?? null,
              photo: player.player?.photo ?? null,
            },
            team: {
              id: statistic?.team?.id ?? null,
              name: statistic?.team?.name ?? null,
              logo: statistic?.team?.logo ?? null,
            },
          };
        })
        .filter((item) => item.value > 0)
        .sort((left, right) => right.value - left.value);

      const startIndex = (params.page - 1) * params.limit;

      return {
        key: section.key,
        title: section.title,
        items: rankedItems
          .slice(startIndex, startIndex + params.limit)
          .map((item, index) => ({
            rank: startIndex + index + 1,
            ...item,
          })),
      };
    });
  }

  private getLeaguePlayerStatSectionDefinitions(
    category: LeaguePlayerStatsCategory,
  ): Array<{
    key: string;
    title: string;
    getValue: (
      statistics?: NonNullable<PlayerStatsItem['statistics']>[number],
    ) => number;
  }> {
    if (category === LeaguePlayerStatsCategory.MINUTES) {
      return [
        {
          key: 'minutesPlayed',
          title: 'Minutes Played',
          getValue: (statistics) => statistics?.games?.minutes ?? 0,
        },
      ];
    }

    if (category === LeaguePlayerStatsCategory.ATTACK) {
      return [
        {
          key: 'shotAttempts',
          title: 'Shot Attempts',
          getValue: (statistics) => statistics?.shots?.total ?? 0,
        },
        {
          key: 'shotsOnTarget',
          title: 'Shots on Target',
          getValue: (statistics) => statistics?.shots?.on ?? 0,
        },
        {
          key: 'penaltyScored',
          title: 'Penalty Scored',
          getValue: (statistics) => statistics?.penalty?.scored ?? 0,
        },
        {
          key: 'penaltyMissed',
          title: 'Penalty Missed',
          getValue: (statistics) => statistics?.penalty?.missed ?? 0,
        },
      ];
    }

    if (category === LeaguePlayerStatsCategory.DEFENSE) {
      return [
        {
          key: 'tackles',
          title: 'Tackles',
          getValue: (statistics) => statistics?.tackles?.total ?? 0,
        },
        {
          key: 'interceptions',
          title: 'Interceptions',
          getValue: (statistics) => statistics?.tackles?.interceptions ?? 0,
        },
        {
          key: 'blocks',
          title: 'Blocks',
          getValue: (statistics) => statistics?.tackles?.blocks ?? 0,
        },
      ];
    }

    if (category === LeaguePlayerStatsCategory.GOALKEEPING) {
      return [
        {
          key: 'saves',
          title: 'Saves',
          getValue: (statistics) => statistics?.goals?.saves ?? 0,
        },
        {
          key: 'goalsConceded',
          title: 'Goals Conceded',
          getValue: (statistics) => statistics?.goals?.conceded ?? 0,
        },
        {
          key: 'penaltySaved',
          title: 'Penalty Saved',
          getValue: (statistics) => statistics?.penalty?.saved ?? 0,
        },
      ];
    }

    return [
      {
        key: 'yellowCards',
        title: 'Yellow Cards',
        getValue: (statistics) => statistics?.cards?.yellow ?? 0,
      },
      {
        key: 'redCards',
        title: 'Red Cards',
        getValue: (statistics) => statistics?.cards?.red ?? 0,
      },
      {
        key: 'foulsCommitted',
        title: 'Fouls Committed',
        getValue: (statistics) => statistics?.fouls?.committed ?? 0,
      },
      {
        key: 'foulsDrawn',
        title: 'Fouls Drawn',
        getValue: (statistics) => statistics?.fouls?.drawn ?? 0,
      },
    ];
  }

  async getLeagueTeamStats(
    leagueId: string,
    query: LeagueTeamStatsQueryDto,
  ): Promise<{
    leagueId: string;
    season: string;
    category: LeagueTeamStatsCategory;
    sections: TeamStatsSection[];
    meta: {
      page: number;
      limit: number;
    };
  }> {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.toPositiveNumber(query.limit, 10);

    if (query.category === LeagueTeamStatsCategory.TOP_STATS) {
      const sections = await this.getLeagueTopTeamStatsSections({
        leagueId,
        season: query.season,
        page,
        limit,
      });

      return {
        leagueId,
        season: query.season,
        category: query.category,
        sections,
        meta: {
          page,
          limit,
        },
      };
    }

    const players = await this.getAllLeaguePlayersForTeamStats({
      leagueId,
      season: query.season,
    });

    const aggregatedTeamStats = this.aggregatePlayerStatsByTeam(
      players,
      leagueId,
    );
    const sections = this.buildTeamStatSections({
      category: query.category,
      teams: aggregatedTeamStats,
      page,
      limit,
    });

    return {
      leagueId,
      season: query.season,
      category: query.category,
      sections,
      meta: {
        page,
        limit,
      },
    };
  }

  private async getLeagueTopTeamStatsSections(params: {
    leagueId: string;
    season: string;
    page: number;
    limit: number;
  }): Promise<TeamStatsSection[]> {
    const teamsResponse = (await this.footballService.getTeams({
      league: params.leagueId,
      season: params.season,
    })) as ApiFootballArrayResponse<LeagueTeamItem>;

    const teams = teamsResponse.response ?? [];

    const teamStats: TeamStatisticsItem[] = [];

    for (const item of teams) {
      const teamId = item.team?.id;

      if (!teamId) {
        continue;
      }

      const statsResponse = (await this.footballService.getTeamStatistics({
        league: params.leagueId,
        season: params.season,
        team: String(teamId),
      })) as ApiFootballObjectResponse<TeamStatisticsItem>;

      if (!statsResponse.response) {
        continue;
      }

      teamStats.push(statsResponse.response);
    }

    return this.buildTopStatsSections({
      stats: teamStats,
      page: params.page,
      limit: params.limit,
    });
  }

  private buildTopStatsSections(params: {
    stats: TeamStatisticsItem[];
    page: number;
    limit: number;
  }): TeamStatsSection[] {
    const sections = [
      {
        key: 'goalsPerMatch',
        title: 'Goals per Match',
        sort: 'DESC' as const,
        getValue: (stats: TeamStatisticsItem) =>
          this.toNumber(stats.goals?.for?.average?.total),
      },
      {
        key: 'goalsConcededPerMatch',
        title: 'Goals Conceded per Match',
        sort: 'ASC' as const,
        getValue: (stats: TeamStatisticsItem) =>
          this.toNumber(stats.goals?.against?.average?.total),
      },
      {
        key: 'cleanSheets',
        title: 'Clean Sheets',
        sort: 'DESC' as const,
        getValue: (stats: TeamStatisticsItem) => stats.clean_sheet?.total ?? 0,
      },
      {
        key: 'wins',
        title: 'Wins',
        sort: 'DESC' as const,
        getValue: (stats: TeamStatisticsItem) =>
          stats.fixtures?.wins?.total ?? 0,
      },
      {
        key: 'failedToScore',
        title: 'Failed to Score',
        sort: 'ASC' as const,
        getValue: (stats: TeamStatisticsItem) =>
          stats.failed_to_score?.total ?? 0,
      },
    ];

    return sections.map((section) => {
      const ranked = params.stats
        .map((stats) => ({
          value: section.getValue(stats),
          team: {
            id: stats.team?.id ?? null,
            name: stats.team?.name ?? null,
            logo: stats.team?.logo ?? null,
          },
        }))
        .filter((item) => item.value > 0 || section.key === 'failedToScore')
        .sort((left, right) => {
          return section.sort === 'ASC'
            ? left.value - right.value
            : right.value - left.value;
        });

      return {
        key: section.key,
        title: section.title,
        items: this.paginateRankedTeams({
          items: ranked,
          page: params.page,
          limit: params.limit,
        }),
      };
    });
  }

  private async getAllLeaguePlayersForTeamStats(params: {
    leagueId: string;
    season: string;
  }): Promise<PlayerStatsItem[]> {
    const firstPage = (await this.footballService.getPlayersApiPage({
      league: params.leagueId,
      season: params.season,
      page: '1',
    })) as ApiFootballArrayResponse<PlayerStatsItem>;

    const totalPages = firstPage.paging?.total ?? 1;
    const maxPages = this.toPositiveNumber(
      process.env.LEAGUE_TEAM_STATS_MAX_API_PAGES,
      totalPages,
    );

    const pagesToFetch = Math.min(totalPages, maxPages);
    const players = [...(firstPage.response ?? [])];

    for (let page = 2; page <= pagesToFetch; page += 1) {
      const response = (await this.footballService.getPlayersApiPage({
        league: params.leagueId,
        season: params.season,
        page: String(page),
      })) as ApiFootballArrayResponse<PlayerStatsItem>;

      players.push(...(response.response ?? []));
    }

    return players;
  }

  private aggregatePlayerStatsByTeam(
    players: PlayerStatsItem[],
    leagueId: string,
  ): TeamAggregatedPlayerStats[] {
    const teamMap = new Map<string, TeamAggregatedPlayerStats>();

    for (const player of players) {
      for (const stat of player.statistics ?? []) {
        if (stat.league?.id && String(stat.league.id) !== leagueId) {
          continue;
        }

        const teamId = stat.team?.id;

        if (!teamId) {
          continue;
        }

        const key = String(teamId);

        const existing = teamMap.get(key) ?? {
          team: {
            id: stat.team?.id ?? null,
            name: stat.team?.name ?? null,
            logo: stat.team?.logo ?? null,
          },
          metrics: {
            shotAttempts: 0,
            shotsOnTarget: 0,
            penaltyScored: 0,
            penaltyMissed: 0,
            keyPasses: 0,
            tackles: 0,
            interceptions: 0,
            blocks: 0,
            saves: 0,
            goalsConceded: 0,
            yellowCards: 0,
            redCards: 0,
            foulsCommitted: 0,
            foulsDrawn: 0,
          },
        };

        existing.metrics.shotAttempts += stat.shots?.total ?? 0;
        existing.metrics.shotsOnTarget += stat.shots?.on ?? 0;
        existing.metrics.penaltyScored += stat.penalty?.scored ?? 0;
        existing.metrics.penaltyMissed += stat.penalty?.missed ?? 0;
        existing.metrics.keyPasses += stat.passes?.key ?? 0;

        existing.metrics.tackles += stat.tackles?.total ?? 0;
        existing.metrics.interceptions += stat.tackles?.interceptions ?? 0;
        existing.metrics.blocks += stat.tackles?.blocks ?? 0;
        existing.metrics.saves += stat.goals?.saves ?? 0;
        existing.metrics.goalsConceded += stat.goals?.conceded ?? 0;

        existing.metrics.yellowCards += stat.cards?.yellow ?? 0;
        existing.metrics.redCards += stat.cards?.red ?? 0;
        existing.metrics.foulsCommitted += stat.fouls?.committed ?? 0;
        existing.metrics.foulsDrawn += stat.fouls?.drawn ?? 0;

        teamMap.set(key, existing);
      }
    }

    return Array.from(teamMap.values());
  }

  private buildTeamStatSections(params: {
    category: LeagueTeamStatsCategory;
    teams: TeamAggregatedPlayerStats[];
    page: number;
    limit: number;
  }): TeamStatsSection[] {
    const sections = this.getTeamStatSectionDefinitions(params.category);

    return sections.map((section) => {
      const ranked = params.teams
        .map((team) => ({
          value: section.getValue(team),
          team: team.team,
        }))
        .filter((item) => item.value > 0)
        .sort((left, right) => right.value - left.value);

      return {
        key: section.key,
        title: section.title,
        items: this.paginateRankedTeams({
          items: ranked,
          page: params.page,
          limit: params.limit,
        }),
      };
    });
  }

  private getTeamStatSectionDefinitions(
    category: LeagueTeamStatsCategory,
  ): Array<{
    key: string;
    title: string;
    getValue: (team: TeamAggregatedPlayerStats) => number;
  }> {
    if (category === LeagueTeamStatsCategory.ATTACK) {
      return [
        {
          key: 'shotAttempts',
          title: 'Shot Attempts',
          getValue: (team) => team.metrics.shotAttempts,
        },
        {
          key: 'shotsOnTarget',
          title: 'Shots on Target',
          getValue: (team) => team.metrics.shotsOnTarget,
        },
        {
          key: 'keyPasses',
          title: 'Key Passes',
          getValue: (team) => team.metrics.keyPasses,
        },
        {
          key: 'penaltyScored',
          title: 'Penalty Scored',
          getValue: (team) => team.metrics.penaltyScored,
        },
        {
          key: 'penaltyMissed',
          title: 'Penalty Missed',
          getValue: (team) => team.metrics.penaltyMissed,
        },
      ];
    }

    if (category === LeagueTeamStatsCategory.DEFENSE) {
      return [
        {
          key: 'tackles',
          title: 'Tackles',
          getValue: (team) => team.metrics.tackles,
        },
        {
          key: 'interceptions',
          title: 'Interceptions',
          getValue: (team) => team.metrics.interceptions,
        },
        {
          key: 'blocks',
          title: 'Blocks',
          getValue: (team) => team.metrics.blocks,
        },
        {
          key: 'saves',
          title: 'Saves',
          getValue: (team) => team.metrics.saves,
        },
        {
          key: 'goalsConceded',
          title: 'Goals Conceded',
          getValue: (team) => team.metrics.goalsConceded,
        },
      ];
    }

    return [
      {
        key: 'yellowCards',
        title: 'Yellow Cards',
        getValue: (team) => team.metrics.yellowCards,
      },
      {
        key: 'redCards',
        title: 'Red Cards',
        getValue: (team) => team.metrics.redCards,
      },
      {
        key: 'foulsCommitted',
        title: 'Fouls Committed',
        getValue: (team) => team.metrics.foulsCommitted,
      },
      {
        key: 'foulsDrawn',
        title: 'Fouls Drawn',
        getValue: (team) => team.metrics.foulsDrawn,
      },
    ];
  }

  private paginateRankedTeams(params: {
    items: Array<{
      value: number;
      team: {
        id: number | null;
        name: string | null;
        logo: string | null;
      };
    }>;
    page: number;
    limit: number;
  }) {
    const startIndex = (params.page - 1) * params.limit;

    return params.items
      .slice(startIndex, startIndex + params.limit)
      .map((item, index) => ({
        rank: startIndex + index + 1,
        value: item.value,
        team: item.team,
      }));
  }

  private toNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }

    const parsed = Number(value);

    return Number.isNaN(parsed) ? 0 : parsed;
  }
}

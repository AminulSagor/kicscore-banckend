import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from 'src/modules/auth/guards/optional-jwt-auth.guard';
import type { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

import { FootballService } from './football.service';
import { SearchQueryDto } from './dto/football-filters.dto';
import { FootballQueryDto } from './dto/football-query.dto';
import { LeagueFixturesQueryDto } from './dto/league-fixtures-query.dto';
import { FootballCompositeService } from './football-composite.service';
import { FootballCompositeQueryDto } from './dto/football-composite-query.dto';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FootballLeaguesByIdsQueryDto } from './dto/football-leagues-by-ids-query.dto';
import { LeaguePlayerStatsQueryDto } from './dto/league-player-stats-query.dto';
import { LeagueTeamStatsQueryDto } from './dto/league-team-stats-query.dto';

@Public()
@Controller('football')
export class FootballController {
  constructor(
    private readonly footballService: FootballService,
    private readonly footballCompositeService: FootballCompositeService,
  ) {}

  private buildFollowContext(
    user: JwtPayload | null,
    installationId: string | undefined,
    entityType: FollowEntityType,
    entityId: string,
  ) {
    return {
      userId: user?.sub ?? null,
      installationId: installationId ?? null,
      entityType,
      entityId,
    };
  }

  @Get('fixtures/live')
  getLiveFixtures() {
    return this.footballService.getLiveFixtures();
  }

  @Get('fixtures/by-time')
  getFixturesByTime(@Query() query: LeagueFixturesQueryDto) {
    return this.footballService.getFixturesByTime(query);
  }

  @Get('fixtures/head-to-head')
  getHeadToHead(@Query() query: FootballQueryDto) {
    return this.footballService.getHeadToHead(query);
  }

  @Get('fixtures/rounds')
  getFixtureRounds(@Query() query: FootballQueryDto) {
    return this.footballService.getFixtureRounds(query);
  }

  @Get('fixtures/:fixtureId/events')
  getFixtureEvents(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.footballService.getFixtureEvents(String(fixtureId));
  }

  @Get('fixtures/:fixtureId/statistics')
  getFixtureStatistics(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.footballService.getFixtureStatistics(String(fixtureId));
  }

  @Get('fixtures/:fixtureId/lineups')
  getFixtureLineups(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.footballService.getFixtureLineups(String(fixtureId));
  }

  @Get('fixtures/:fixtureId/players')
  getFixturePlayers(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.footballService.getFixturePlayers(String(fixtureId));
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('fixtures/:fixtureId')
  async getFixtureById(
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    const data = await this.footballService.getFixtureById(String(fixtureId));

    return this.footballCompositeService.withFollowMeta(
      data as Record<string, unknown>,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.FIXTURE,
        String(fixtureId),
      ),
    );
  }

  @Get('fixtures')
  getFixtures(@Query() query: FootballQueryDto) {
    return this.footballService.getFixtures(query);
  }

  @Get('teams/:teamId/fixtures')
  getTeamFixtures(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballQueryDto,
  ) {
    return this.footballService.getTeamFixtures(String(teamId), query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('teams/:teamId/overview')
  getTeamOverview(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getTeamOverview(
      String(teamId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.TEAM,
        String(teamId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('teams/:teamId/top-players')
  getTeamTopPlayers(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getTeamTopPlayers(
      String(teamId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.TEAM,
        String(teamId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('teams/:teamId/about')
  getTeamAbout(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getTeamAbout(
      String(teamId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.TEAM,
        String(teamId),
      ),
    );
  }

  @Get('teams/:teamId/trophies-preview')
  getTeamTrophiesPreview(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getTeamTrophiesPreview(
      String(teamId),
      query,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('teams')
  async getTeams(
    @Query() query: FootballQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    const data = await this.footballService.getTeams(query);

    if (!query.id) {
      return data;
    }

    return this.footballCompositeService.withFollowMeta(
      data as Record<string, unknown>,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.TEAM,
        String(query.id),
      ),
    );
  }

  @Get('league')
  getFixturesGroupedByLeague(@Query() query: LeagueFixturesQueryDto) {
    return this.footballService.getFixturesGroupedByLeague(query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('leagues')
  async getLeagues(
    @Query() query: FootballQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    const data = await this.footballService.getLeagues(query);

    if (!query.id) {
      return data;
    }

    return this.footballCompositeService.withFollowMeta(
      data as Record<string, unknown>,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.LEAGUE,
        String(query.id),
      ),
    );
  }

  @Get('countries')
  getCountries(@Query() query: FootballQueryDto) {
    return this.footballService.getCountries(query);
  }

  @Get('standings')
  getStandings(@Query() query: FootballQueryDto) {
    return this.footballService.getStandings(query);
  }

  @Get('players/squads')
  getPlayerSquads(@Query() query: FootballQueryDto) {
    return this.footballService.getPlayerSquads(query);
  }

  @Get('players/top-scorers')
  getTopScorers(@Query() query: FootballQueryDto) {
    return this.footballService.getTopScorers(query);
  }

  @Get('players/top-assists')
  getTopAssists(@Query() query: FootballQueryDto) {
    return this.footballService.getTopAssists(query);
  }

  // @Get('players/top-cards')
  // getTopCards(@Query() query: FootballQueryDto) {
  //   return this.footballService.getTopCards(query);
  // }

  @Get('leagues/:leagueId/player-stats')
  getLeaguePlayerStats(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query() query: LeaguePlayerStatsQueryDto,
  ) {
    return this.footballCompositeService.getLeaguePlayerStats(
      String(leagueId),
      query,
    );
  }

  @Get('leagues/:leagueId/team-stats')
  getLeagueTeamStats(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query() query: LeagueTeamStatsQueryDto,
  ) {
    return this.footballCompositeService.getLeagueTeamStats(
      String(leagueId),
      query,
    );
  }

  @Get('players/profiles')
  getPlayerProfiles(@Query() query: FootballQueryDto) {
    return this.footballService.getPlayerProfiles(query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('players')
  async getPlayers(
    @Query() query: FootballQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    const data = await this.footballService.getPlayers(query);

    if (!query.id) {
      return data;
    }

    return this.footballCompositeService.withFollowMeta(
      data as Record<string, unknown>,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.PLAYER,
        String(query.id),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('players/:playerId/recent-matches')
  getPlayerRecentMatches(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getPlayerRecentMatches(
      String(playerId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.PLAYER,
        String(playerId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('players/:playerId/career-totals')
  getPlayerCareerTotals(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getPlayerCareerTotals(
      String(playerId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.PLAYER,
        String(playerId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('players/:playerId/traits')
  getPlayerTraits(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getPlayerTraits(
      String(playerId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.PLAYER,
        String(playerId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('players/:playerId/trophies/grouped')
  getGroupedPlayerTrophies(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getGroupedPlayerTrophies(
      String(playerId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.PLAYER,
        String(playerId),
      ),
    );
  }

  @Get('transfers')
  getTransfers(@Query() query: FootballQueryDto) {
    return this.footballService.getTransfers(query);
  }

  @Get('injuries')
  getInjuries(@Query() query: FootballQueryDto) {
    return this.footballService.getInjuries(query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('coaches/:coachId/current-record')
  getCoachCurrentRecord(
    @Param('coachId', ParseIntPipe) coachId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getCoachCurrentRecord(
      String(coachId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.COACH,
        String(coachId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('coaches/:coachId/trophies/grouped')
  getGroupedCoachTrophies(
    @Param('coachId', ParseIntPipe) coachId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getGroupedCoachTrophies(
      String(coachId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.COACH,
        String(coachId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('coaches')
  async getCoaches(
    @Query() query: FootballQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    const data = await this.footballService.getCoaches(query);

    if (!query.id) {
      return data;
    }

    return this.footballCompositeService.withFollowMeta(
      data as Record<string, unknown>,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.COACH,
        String(query.id),
      ),
    );
  }

  @Get('trophies')
  getTrophies(@Query() query: FootballQueryDto) {
    return this.footballService.getTrophies(query);
  }

  @Get('venues')
  getVenues(@Query() query: FootballQueryDto) {
    return this.footballService.getVenues(query);
  }

  @Get('predictions')
  getPredictions(@Query() query: FootballQueryDto) {
    return this.footballService.getPredictions(query);
  }

  @Get('search')
  searchAll(@Query() query: SearchQueryDto) {
    return this.footballService.searchAll(query.q, {
      season: query.season,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('popular')
  getPopularEntities(@Query() query: FootballCompositeQueryDto) {
    const entityType = query.entityType ?? 'TEAM';

    return this.footballCompositeService.getPopularEntities({
      entityType: entityType as FollowEntityType,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('leagues/top')
  getTopLeagues(@Query() query: FootballCompositeQueryDto) {
    return this.footballCompositeService.getTopLeagues(query);
  }

  @Get('leagues/by-ids')
  getLeaguesByIds(@Query() query: FootballLeaguesByIdsQueryDto) {
    return this.footballCompositeService.getLeaguesByIds(query);
  }

  @Get('leagues/by-country')
  getLeaguesByCountry(@Query() query: FootballCompositeQueryDto) {
    return this.footballCompositeService.getLeaguesByCountry(query);
  }

  @Get('leagues/seasons')
  getLeaguesSeasons(@Query() query: FootballQueryDto) {
    return this.footballService.getLeaguesSeasons(query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('matches/:fixtureId/about')
  getMatchAbout(
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getMatchAbout(
      String(fixtureId),
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.FIXTURE,
        String(fixtureId),
      ),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('matches/:fixtureId/knockout-bracket')
  getKnockoutBracket(
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @Query() query: FootballCompositeQueryDto,
    @CurrentUser() user: JwtPayload | null,
    @Headers('x-installation-id') installationId?: string,
  ) {
    return this.footballCompositeService.getKnockoutBracket(
      String(fixtureId),
      query,
      this.buildFollowContext(
        user,
        installationId,
        FollowEntityType.FIXTURE,
        String(fixtureId),
      ),
    );
  }

  @Get('matches/:fixtureId/top-scorers-comparison')
  getMatchTopScorersComparison(
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getMatchTopScorersComparison(
      String(fixtureId),
      query,
    );
  }
}

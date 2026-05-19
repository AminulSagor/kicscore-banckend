import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FootballService } from './football.service';
import { SearchQueryDto } from './dto/football-filters.dto';
import { FootballQueryDto } from './dto/football-query.dto';
import { LeagueFixturesQueryDto } from './dto/league-fixtures-query.dto';
import { FootballCompositeService } from './football-composite.service';
import { FootballCompositeQueryDto } from './dto/football-composite-query.dto';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

@Public()
@Controller('football')
export class FootballController {
  constructor(
    private readonly footballService: FootballService,
    private readonly footballCompositeService: FootballCompositeService,
  ) {}

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

  @Get('fixtures/:fixtureId')
  getFixtureById(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.footballService.getFixtureById(String(fixtureId));
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

  @Get('teams/:teamId/overview')
  getTeamOverview(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getTeamOverview(String(teamId), query);
  }

  @Get('teams/:teamId/top-players')
  getTeamTopPlayers(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getTeamTopPlayers(
      String(teamId),
      query,
    );
  }

  @Get('teams/:teamId/about')
  getTeamAbout(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getTeamAbout(String(teamId), query);
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

  @Get('teams')
  getTeams(@Query() query: FootballQueryDto) {
    return this.footballService.getTeams(query);
  }

  @Get('league')
  getFixturesGroupedByLeague(@Query() query: LeagueFixturesQueryDto) {
    return this.footballService.getFixturesGroupedByLeague(query);
  }

  @Get('leagues')
  getLeagues(@Query() query: FootballQueryDto) {
    return this.footballService.getLeagues(query);
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

  @Get('players/profiles')
  getPlayerProfiles(@Query() query: FootballQueryDto) {
    return this.footballService.getPlayerProfiles(query);
  }

  @Get('players')
  getPlayers(@Query() query: FootballQueryDto) {
    return this.footballService.getPlayers(query);
  }

  @Get('players/:playerId/recent-matches')
  getPlayerRecentMatches(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getPlayerRecentMatches(
      String(playerId),
      query,
    );
  }

  @Get('players/:playerId/career-totals')
  getPlayerCareerTotals(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getPlayerCareerTotals(
      String(playerId),
      query,
    );
  }

  @Get('players/:playerId/traits')
  getPlayerTraits(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getPlayerTraits(
      String(playerId),
      query,
    );
  }

  @Get('players/:playerId/trophies/grouped')
  getGroupedPlayerTrophies(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getGroupedPlayerTrophies(
      String(playerId),
      query,
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

  @Get('coaches/:coachId/current-record')
  getCoachCurrentRecord(
    @Param('coachId', ParseIntPipe) coachId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getCoachCurrentRecord(
      String(coachId),
      query,
    );
  }

  @Get('coaches/:coachId/trophies/grouped')
  getGroupedCoachTrophies(
    @Param('coachId', ParseIntPipe) coachId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getGroupedCoachTrophies(
      String(coachId),
      query,
    );
  }

  @Get('coaches')
  getCoaches(@Query() query: FootballQueryDto) {
    return this.footballService.getCoaches(query);
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

  @Get('leagues/by-country')
  getLeaguesByCountry(@Query() query: FootballCompositeQueryDto) {
    return this.footballCompositeService.getLeaguesByCountry(query);
  }

  @Get('leagues/seasons')
  getLeaguesSeasons(@Query() query: FootballQueryDto) {
    return this.footballService.getLeaguesSeasons(query);
  }

  @Get('matches/:fixtureId/about')
  getMatchAbout(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.footballCompositeService.getMatchAbout(String(fixtureId));
  }

  @Get('matches/:fixtureId/knockout-bracket')
  getKnockoutBracket(
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @Query() query: FootballCompositeQueryDto,
  ) {
    return this.footballCompositeService.getKnockoutBracket(
      String(fixtureId),
      query,
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

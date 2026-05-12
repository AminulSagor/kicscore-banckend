import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FootballService } from './football.service';

type QueryParams = Record<string, string | number | boolean | undefined>;

@Public()
@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('fixtures/live')
  getLiveFixtures() {
    return this.footballService.getLiveFixtures();
  }

  @Get('fixtures/head-to-head')
  getHeadToHead(@Query() query: QueryParams) {
    return this.footballService.getHeadToHead(query);
  }

  @Get('fixtures/rounds')
  getFixtureRounds(@Query() query: QueryParams) {
    return this.footballService.getFixtureRounds(query);
  }

  @Get('fixtures/:fixtureId/events')
  getFixtureEvents(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureEvents(fixtureId);
  }

  @Get('fixtures/:fixtureId/statistics')
  getFixtureStatistics(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureStatistics(fixtureId);
  }

  @Get('fixtures/:fixtureId/lineups')
  getFixtureLineups(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureLineups(fixtureId);
  }

  @Get('fixtures/:fixtureId/players')
  getFixturePlayers(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixturePlayers(fixtureId);
  }

  @Get('fixtures/:fixtureId')
  getFixtureById(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureById(fixtureId);
  }

  @Get('fixtures')
  getFixtures(@Query() query: QueryParams) {
    return this.footballService.getFixtures(query);
  }

  @Get('teams/:teamId/fixtures')
  getTeamFixtures(
    @Param('teamId') teamId: string,
    @Query() query: QueryParams,
  ) {
    return this.footballService.getTeamFixtures(teamId, query);
  }

  @Get('teams')
  getTeams(@Query() query: QueryParams) {
    return this.footballService.getTeams(query);
  }

  @Get('leagues')
  getLeagues(@Query() query: QueryParams) {
    return this.footballService.getLeagues(query);
  }

  @Get('countries')
  getCountries(@Query() query: QueryParams) {
    return this.footballService.getCountries(query);
  }

  @Get('standings')
  getStandings(@Query() query: QueryParams) {
    return this.footballService.getStandings(query);
  }

  @Get('players/squads')
  getPlayerSquads(@Query() query: QueryParams) {
    return this.footballService.getPlayerSquads(query);
  }

  @Get('players/top-scorers')
  getTopScorers(@Query() query: QueryParams) {
    return this.footballService.getTopScorers(query);
  }

  @Get('players/top-assists')
  getTopAssists(@Query() query: QueryParams) {
    return this.footballService.getTopAssists(query);
  }

  @Get('players')
  getPlayers(@Query() query: QueryParams) {
    return this.footballService.getPlayers(query);
  }

  @Get('transfers')
  getTransfers(@Query() query: QueryParams) {
    return this.footballService.getTransfers(query);
  }

  @Get('injuries')
  getInjuries(@Query() query: QueryParams) {
    return this.footballService.getInjuries(query);
  }

  @Get('coaches')
  getCoaches(@Query() query: QueryParams) {
    return this.footballService.getCoaches(query);
  }

  @Get('trophies')
  getTrophies(@Query() query: QueryParams) {
    return this.footballService.getTrophies(query);
  }

  @Get('venues')
  getVenues(@Query() query: QueryParams) {
    return this.footballService.getVenues(query);
  }

  @Get('predictions')
  getPredictions(@Query() query: QueryParams) {
    return this.footballService.getPredictions(query);
  }

  @Get('search')
  searchAll(@Query('q') query: string, @Query('season') season: string) {
    return this.footballService.searchAll(query, season);
  }

  @Get('leagues/seasons')
  getLeaguesSeasons(@Query() query: QueryParams) {
    return this.footballService.getLeaguesSeasons(query);
  }
}


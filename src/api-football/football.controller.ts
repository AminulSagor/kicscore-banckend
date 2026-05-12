import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FootballService } from './football.service';
import {
  FixturesQueryDto,
  PlayersQueryDto,
  SearchQueryDto,
  TeamsQueryDto,
} from './dto/football-filters.dto';

@Public()
@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('fixtures/live')
  getLiveFixtures() {
    return this.footballService.getLiveFixtures();
  }

  @Get('fixtures/head-to-head')
  getHeadToHead(@Query() query: FixturesQueryDto) {
    return this.footballService.getHeadToHead(query);
  }

  @Get('fixtures/rounds')
  getFixtureRounds(@Query() query: FixturesQueryDto) {
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
  getFixtures(@Query() query: FixturesQueryDto) {
    return this.footballService.getFixtures(query);
  }

  @Get('teams/:teamId/fixtures')
  getTeamFixtures(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query() query: FixturesQueryDto,
  ) {
    return this.footballService.getTeamFixtures(String(teamId), query);
  }

  @Get('teams')
  getTeams(@Query() query: TeamsQueryDto) {
    return this.footballService.getTeams(query);
  }

  @Get('leagues')
  getLeagues(@Query() query: TeamsQueryDto) {
    return this.footballService.getLeagues(query);
  }

  @Get('countries')
  getCountries(@Query() query: TeamsQueryDto) {
    return this.footballService.getCountries(query);
  }

  @Get('standings')
  getStandings(@Query() query: TeamsQueryDto) {
    return this.footballService.getStandings(query);
  }

  @Get('players/squads')
  getPlayerSquads(@Query() query: TeamsQueryDto) {
    return this.footballService.getPlayerSquads(query);
  }

  @Get('players/top-scorers')
  getTopScorers(@Query() query: TeamsQueryDto) {
    return this.footballService.getTopScorers(query);
  }

  @Get('players/top-assists')
  getTopAssists(@Query() query: TeamsQueryDto) {
    return this.footballService.getTopAssists(query);
  }

  @Get('players')
  getPlayers(@Query() query: PlayersQueryDto) {
    return this.footballService.getPlayers(query);
  }

  @Get('transfers')
  getTransfers(@Query() query: TeamsQueryDto) {
    return this.footballService.getTransfers(query);
  }

  @Get('injuries')
  getInjuries(@Query() query: TeamsQueryDto) {
    return this.footballService.getInjuries(query);
  }

  @Get('coaches')
  getCoaches(@Query() query: TeamsQueryDto) {
    return this.footballService.getCoaches(query);
  }

  @Get('trophies')
  getTrophies(@Query() query: TeamsQueryDto) {
    return this.footballService.getTrophies(query);
  }

  @Get('venues')
  getVenues(@Query() query: TeamsQueryDto) {
    return this.footballService.getVenues(query);
  }

  @Get('predictions')
  getPredictions(@Query() query: TeamsQueryDto) {
    return this.footballService.getPredictions(query);
  }

  @Get('search')
  searchAll(@Query() query: SearchQueryDto) {
    return this.footballService.searchAll(query.q, query.season);
  }

  @Get('leagues/seasons')
  getLeaguesSeasons(@Query() query: TeamsQueryDto) {
    return this.footballService.getLeaguesSeasons(query);
  }
}


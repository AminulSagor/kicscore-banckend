import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { Public } from 'src/common/decorators/public.decorator';
import { ControllerResponse } from 'src/common/interfaces/api-response.interface';
import { FootballTournamentSeasonsService } from './football-tournament-seasons.service';
import { FootballTournamentSeasonHistoryResponse } from './types/football-tournament-season-response.type';

const WORLD_CUP_LEAGUE_ID = 1;

@Public()
@Controller('football/leagues')
export class FootballTournamentSeasonsController {
  constructor(
    private readonly tournamentSeasonsService: FootballTournamentSeasonsService,
  ) {}

  @Get(':leagueId/seasons/history')
  async getSeasonHistory(
    @Param('leagueId', ParseIntPipe) leagueId: number,
  ): Promise<ControllerResponse<FootballTournamentSeasonHistoryResponse>> {
    if (leagueId !== WORLD_CUP_LEAGUE_ID) {
      throw new NotFoundException(
        'Tournament season history is currently available only for World Cup',
      );
    }

    const data = await this.tournamentSeasonsService.getWorldCupHistory();

    return {
      message: 'World Cup season history fetched successfully',
      data,
    };
  }
}

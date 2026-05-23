import { FootballTournamentSeason } from '../entities/football-tournament-season.entity';
import { FootballTournamentSeasonStatus } from '../enums/football-tournament-season-status.enum';

export interface FootballTournamentSeasonResponseItem {
  season: number;
  winner: {
    id: string | null;
    name: string | null;
    logo: string | null;
  };
  runnerUp: {
    id: string | null;
    name: string | null;
    logo: string | null;
  };
  status: FootballTournamentSeasonStatus;
}

export interface FootballTournamentSeasonHistoryResponse {
  league: {
    id: string;
    name: string;
  };
  seasons: FootballTournamentSeasonResponseItem[];
}

export const mapFootballTournamentSeasonResponse = (
  item: FootballTournamentSeason,
): FootballTournamentSeasonResponseItem => ({
  season: item.season,
  winner: {
    id: item.winnerTeamId,
    name: item.winnerName,
    logo: item.winnerLogo,
  },
  runnerUp: {
    id: item.runnerUpTeamId,
    name: item.runnerUpName,
    logo: item.runnerUpLogo,
  },
  status: item.status,
});

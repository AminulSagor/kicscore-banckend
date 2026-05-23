import { PlayerCareerTeamType } from '../entities/player-career-season-stat.entity';

export interface PlayerCareerApiWrapped<T> {
  response?: T[];
  results?: number;
  errors?: Record<string, string> | unknown[];
  paging?: {
    current?: number;
    total?: number;
  };
}

export interface PlayerCareerGamesStatistics {
  appearances?: number | null;
  appearences?: number | null;
}

export interface PlayerCareerStatisticsApiItem {
  player?: {
    id?: number;
    name?: string;
    nationality?: string;
  };
  statistics?: Array<{
    team?: {
      id?: number;
      name?: string;
      logo?: string;
    };
    league?: {
      id?: number;
      name?: string;
      country?: string;
    };
    games?: PlayerCareerGamesStatistics;
    goals?: {
      total?: number | null;
    };
  }>;
}

export interface PlayerCareerTransferApiItem {
  player?: {
    id?: number;
    name?: string;
  };
  transfers?: Array<{
    date?: string;
    type?: string | null;
    teams?: {
      in?: {
        id?: number | null;
        name?: string | null;
        logo?: string | null;
      };
      out?: {
        id?: number | null;
        name?: string | null;
        logo?: string | null;
      };
    };
  }>;
}

export interface PlayerCareerTransferInput {
  playerId: string;
  transferKey: string;
  transferDate: string;
  transferType: string | null;
  fromTeamId: string | null;
  fromTeamName: string | null;
  fromTeamLogo: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  toTeamLogo: string | null;
}

export interface PlayerCareerSeasonStatInput {
  playerId: string;
  season: number;
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  teamType: PlayerCareerTeamType;
  appearances: number;
  goals: number;
  isCurrentTeam: boolean;
}

export interface PlayerCareerTeamCard {
  team: {
    id: string;
    name: string;
    logo: string | null;
  };
  from: string;
  to: string | null;
  isCurrent: boolean;
  matchesPlayed: number;
  goals: number;
}

export interface PlayerCareerTransferItem {
  id: string;
  date: string;
  type: string | null;
  fromTeam: {
    id: string | null;
    name: string | null;
    logo: string | null;
  };
  toTeam: {
    id: string | null;
    name: string | null;
    logo: string | null;
  };
}

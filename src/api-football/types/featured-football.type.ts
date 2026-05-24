import { FeaturedTeamSection } from 'src/common/constants/featured-football.constant';

export interface FootballApiListResponse<T> {
  response?: T[];
  results?: number;
  errors?: Record<string, string> | unknown[];
}

export interface FootballTeamProfileItem {
  team?: {
    id?: number;
    name?: string;
    code?: string | null;
    country?: string | null;
    founded?: number | null;
    national?: boolean;
    logo?: string | null;
    [key: string]: unknown;
  };
  venue?: Record<string, unknown> | null;
}

export interface FootballPlayerProfileItem {
  player?: {
    id?: number;
    name?: string;
    firstname?: string | null;
    lastname?: string | null;
    age?: number | null;
    nationality?: string | null;
    position?: string | null;
    photo?: string | null;
    [key: string]: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  returned: number;
}

export interface FeaturedTeamListItem {
  rank: number;
  priority: number;
  team: NonNullable<FootballTeamProfileItem['team']>;
}

export interface FeaturedTeamSectionResponse {
  key: FeaturedTeamSection;
  title: string;
  items: FeaturedTeamListItem[];
  meta: PaginationMeta;
}

export interface TopTeamsResponse {
  sections: FeaturedTeamSectionResponse[];
  cache: {
    ttlSeconds: number;
  };
}

export interface FeaturedPlayerListItem {
  rank: number;
  priority: number;
  player: NonNullable<FootballPlayerProfileItem['player']>;
}

export interface TopPlayersResponse {
  items: FeaturedPlayerListItem[];
  meta: PaginationMeta;
  cache: {
    ttlSeconds: number;
  };
}

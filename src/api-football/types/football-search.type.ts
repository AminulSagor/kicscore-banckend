export interface FootballSearchLeagueItem {
  league?: {
    id?: number;
    name?: string;
    type?: string;
    logo?: string;
  };
  country?: {
    name?: string;
    code?: string | null;
    flag?: string | null;
  };
  seasons?: unknown[];
}

export interface FootballSearchPlayerItem {
  player?: {
    id?: number;
    name?: string;
    firstname?: string | null;
    lastname?: string | null;
    age?: number | null;
    nationality?: string | null;
    position?: string | null;
    photo?: string | null;
  };
}

export interface FootballSearchApiResponse<T> {
  get?: string;
  parameters?: Record<string, string>;
  errors?: Record<string, string> | unknown[];
  results?: number;
  paging?: {
    current?: number;
    total?: number;
  };
  response?: T[];
  backendPaging?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

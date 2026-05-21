export interface ApiFootballFixturesResponse {
  get?: string;
  parameters?: Record<string, unknown>;
  errors?: unknown;
  results?: number;
  paging?: {
    current: number;
    total: number;
  };
  response?: ApiFootballFixture[];
}

export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    timezone?: string;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
      extra?: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
    standings?: boolean;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}
export interface LeagueFixturesGroup {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
    standings?: boolean;
  };
  matchCount: number;
  fixtures: ApiFootballFixture[];
}

export interface FixturesByTimeResponse {
  date: string;
  timezone: string;
  items: ApiFootballFixturesResponse['response'];
  meta: {
    page: number;
    limit: number;
    totalFixtures: number;
    totalPages: number;
  };
}

export type ApiFootballWrapped<T> = {
  response?: T[];
  results?: number;
};

export interface TeamProfileItem {
  team?: {
    id?: number;
    name?: string;
    country?: string;
    founded?: number | null;
  };
  venue?: {
    name?: string | null;
    city?: string | null;
    capacity?: number | null;
    surface?: string | null;
  };
}

export interface FixtureItem {
  fixture?: {
    id?: number;
    date?: string;
    timestamp?: number;
    venue?: {
      name?: string | null;
      city?: string | null;
    };
    status?: {
      long?: string;
      short?: string;
      elapsed?: number | null;
    };
  };
  league?: {
    id?: number;
    name?: string;
    country?: string;
    season?: number;
    round?: string;
  };
  teams?: {
    home?: {
      id?: number;
      name?: string;
      winner?: boolean | null;
    };
    away?: {
      id?: number;
      name?: string;
      winner?: boolean | null;
    };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
}

export interface StandingRow {
  rank?: number;
  team?: {
    id?: number;
    name?: string;
  };
  points?: number;
  goalsDiff?: number;
  form?: string | null;
  description?: string | null;
}

export interface StandingLeagueBlock {
  league?: {
    id?: number;
    name?: string;
    standings?: StandingRow[][];
  };
}

export interface PlayerStatsItem {
  player?: {
    id?: number;
    name?: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    nationality?: string;
    position?: string;
    photo?: string;
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
    };
    games?: {
      appearances?: number | null;
      minutes?: number | null;
      rating?: string | null;
    };
    goals?: {
      total?: number | null;
      conceded?: number | null;
      assists?: number | null;
      saves?: number | null;
    };
    shots?: {
      total?: number | null;
      on?: number | null;
    };
    passes?: {
      total?: number | null;
      key?: number | null;
      accuracy?: number | null;
    };
    tackles?: {
      total?: number | null;
      blocks?: number | null;
      interceptions?: number | null;
    };
    duels?: {
      total?: number | null;
      won?: number | null;
    };
    dribbles?: {
      attempts?: number | null;
      success?: number | null;
    };
    fouls?: {
      drawn?: number | null;
      committed?: number | null;
    };
    cards?: {
      yellow?: number | null;
      red?: number | null;
    };
    penalty?: {
      scored?: number | null;
      missed?: number | null;
      saved?: number | null;
    };
  }>;
}

export interface FixturePlayersResponse {
  response?: FixturePlayerTeam[];
}

export interface FixturePlayerTeam {
  team?: {
    id?: number;
    name?: string;
  };
  players?: FixturePlayerItem[];
}

export interface FixturePlayerItem {
  player?: {
    id?: number;
    name?: string;
  };
  statistics?: Array<{
    games?: {
      minutes?: number | null;
      number?: number | null;
      position?: string | null;
      rating?: string | null;
      substitute?: boolean | null;
    };
    goals?: {
      total?: number | null;
      assists?: number | null;
    };
    cards?: {
      yellow?: number | null;
      red?: number | null;
    };
  }>;
}

export interface FixtureEventsResponse {
  response?: FixtureEventItem[];
}

export interface FixtureEventItem {
  time?: {
    elapsed?: number | null;
    extra?: number | null;
  };
  team?: {
    id?: number | null;
    name?: string | null;
  };
  player?: {
    id?: number | null;
    name?: string | null;
  };
  assist?: {
    id?: number | null;
    name?: string | null;
  };
  type?: string;
  detail?: string;
  comments?: string | null;
}

export interface PlayerRecentMatchItem {
  fixtureId: string;
  fixture: FixtureItem;
  player: {
    minutes: number | null;
    rating: string | null;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    substitute: boolean | null;
    position: string | null;
    number: number | null;
    events: PlayerMatchEvent[];
    eventChips: string[];
  };
}

export interface PlayerMatchEvent {
  type: string;
  detail: string;
  minute: string | null;
  role: 'PLAYER' | 'ASSIST';
}

export interface TeamLeagueItem {
  league: {
    id: number;
    name: string;
    type: 'League' | 'Cup';
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: Array<{
    year: number;
    coverage?: {
      standings?: boolean;
      fixtures?: {
        events?: boolean;
      };
    };
  }>;
}

export interface TeamTrophyPreviewGroupInput {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string | null;
    country: string;
    flag: string | null;
  };
  winnerSeasons: number[];
  runnerUpSeasons: number[];
}

export interface StandingResponseItem {
  league?: {
    id?: number;
    name?: string;
    standings?: StandingRow[][];
  };
}

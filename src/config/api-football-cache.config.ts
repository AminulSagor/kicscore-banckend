export const getNumberEnv = (key: string, fallback: number): number => {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  return Number.isNaN(parsedValue) ? fallback : parsedValue;
};

export const apiFootballCacheConfig = {
  liveFixtures: {
    ttl: getNumberEnv('CACHE_TTL_LIVE_FIXTURES_SECONDS', 30),
    staleTtl: getNumberEnv('CACHE_STALE_LIVE_FIXTURES_SECONDS', 120),
  },
  liveFixtureDetail: {
    ttl: getNumberEnv('CACHE_TTL_LIVE_FIXTURE_DETAIL_SECONDS', 30),
    staleTtl: getNumberEnv('CACHE_STALE_LIVE_FIXTURE_DETAIL_SECONDS', 120),
  },
  liveEvents: {
    ttl: getNumberEnv('CACHE_TTL_LIVE_EVENTS_SECONDS', 20),
    staleTtl: getNumberEnv('CACHE_STALE_LIVE_EVENTS_SECONDS', 90),
  },
  liveStats: {
    ttl: getNumberEnv('CACHE_TTL_LIVE_STATS_SECONDS', 60),
    staleTtl: getNumberEnv('CACHE_STALE_LIVE_STATS_SECONDS', 240),
  },
  fixturesToday: {
    ttl: getNumberEnv('CACHE_TTL_FIXTURES_TODAY_SECONDS', 300),
    staleTtl: getNumberEnv('CACHE_STALE_FIXTURES_TODAY_SECONDS', 900),
  },
  fixturesFuture: {
    ttl: getNumberEnv('CACHE_TTL_FIXTURES_FUTURE_SECONDS', 21600),
    staleTtl: getNumberEnv('CACHE_STALE_FIXTURES_FUTURE_SECONDS', 43200),
  },
  fixturesPast: {
    ttl: getNumberEnv('CACHE_TTL_FIXTURES_PAST_SECONDS', 86400),
    staleTtl: getNumberEnv('CACHE_STALE_FIXTURES_PAST_SECONDS', 604800),
  },
  lineupsBeforeFound: {
    ttl: getNumberEnv('CACHE_TTL_LINEUPS_BEFORE_FOUND_SECONDS', 600),
    staleTtl: getNumberEnv('CACHE_STALE_LINEUPS_BEFORE_FOUND_SECONDS', 1800),
  },
  lineupsAfterFound: {
    ttl: getNumberEnv('CACHE_TTL_LINEUPS_AFTER_FOUND_SECONDS', 86400),
    staleTtl: getNumberEnv('CACHE_STALE_LINEUPS_AFTER_FOUND_SECONDS', 604800),
  },
  teamProfile: {
    ttl: getNumberEnv('CACHE_TTL_TEAM_PROFILE_SECONDS', 2592000),
    staleTtl: getNumberEnv('CACHE_STALE_TEAM_PROFILE_SECONDS', 6048000),
  },
  leagueProfile: {
    ttl: getNumberEnv('CACHE_TTL_LEAGUE_PROFILE_SECONDS', 2592000),
    staleTtl: getNumberEnv('CACHE_STALE_LEAGUE_PROFILE_SECONDS', 6048000),
  },
  standings: {
    ttl: getNumberEnv('CACHE_TTL_STANDINGS_SECONDS', 1800),
    staleTtl: getNumberEnv('CACHE_STALE_STANDINGS_SECONDS', 7200),
  },
  topScorers: {
    ttl: getNumberEnv('CACHE_TTL_TOP_SCORERS_SECONDS', 3600),
    staleTtl: getNumberEnv('CACHE_STALE_TOP_SCORERS_SECONDS', 21600),
  },
  topAssists: {
    ttl: getNumberEnv('CACHE_TTL_TOP_ASSISTS_SECONDS', 3600),
    staleTtl: getNumberEnv('CACHE_STALE_TOP_ASSISTS_SECONDS', 21600),
  },
  transfers: {
    ttl: getNumberEnv('CACHE_TTL_TRANSFERS_SECONDS', 21600),
    staleTtl: getNumberEnv('CACHE_STALE_TRANSFERS_SECONDS', 86400),
  },
  search: {
    ttl: getNumberEnv('CACHE_TTL_SEARCH_SECONDS', 604800),
    staleTtl: getNumberEnv('CACHE_STALE_SEARCH_SECONDS', 2592000),
  },
};

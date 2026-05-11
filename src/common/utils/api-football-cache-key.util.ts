type CacheParamValue = string | number | boolean | undefined | null;

export const buildApiFootballCacheKey = (
  endpoint: string,
  params: Record<string, CacheParamValue>,
): string => {
  const normalizedEndpoint = endpoint.replace(/^\/+/, '').replace(/\//g, ':');

  const normalizedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(':');

  return normalizedParams
    ? `api-football:${normalizedEndpoint}:${normalizedParams}`
    : `api-football:${normalizedEndpoint}`;
};

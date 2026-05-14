import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ApiFootballClient } from './api-football.client';
import { ApiFootballRequestPriority } from './enums/api-football-request-priority.enum';

type QueryParams = Record<string, string | number | boolean | undefined>;

interface CachedApiOptions<T> {
  endpoint: string;
  params?: QueryParams;
  cacheKey: string;
  ttlSeconds: number;
  staleTtlSeconds: number;
  lockTtlSeconds?: number;
  priority?: ApiFootballRequestPriority;
}

@Injectable()
export class ApiFootballCacheService {
  constructor(
    private readonly redisService: RedisService,
    private readonly apiFootballClient: ApiFootballClient,
  ) {}

  async getCached<T>(options: CachedApiOptions<T>): Promise<T> {
    const {
      endpoint,
      params,
      cacheKey,
      ttlSeconds,
      staleTtlSeconds,
      lockTtlSeconds = 10,
      priority = ApiFootballRequestPriority.MEDIUM,
    } = options;

    const staleKey = `${cacheKey}:stale`;
    const lockKey = `lock:${cacheKey}`;

    const cachedData = await this.redisService.get<T>(cacheKey);

    if (cachedData) {
      console.log('CACHE HIT:', cacheKey);
      return cachedData;
    }
    console.log('CACHE MISS:', cacheKey);

    const hasLock = await this.redisService.setLock(lockKey, lockTtlSeconds);

    if (hasLock) {
      try {
        const staleData = await this.redisService.get<T>(staleKey);

        try {
          await this.assertApiBudgetAllowsRequest(priority);
        } catch (error) {
          if (staleData) {
            return staleData;
          }

          throw error;
        }

        const freshData = await this.apiFootballClient.get<T>(endpoint, params);

        await this.redisService.set(cacheKey, freshData, ttlSeconds);
        await this.redisService.set(staleKey, freshData, staleTtlSeconds);

        await this.trackApiUsage();

        return freshData;
      } finally {
        await this.redisService.del(lockKey);
      }
    }

    const dataAfterWait = await this.waitForFreshCache<T>(cacheKey);

    if (dataAfterWait) {
      return dataAfterWait;
    }

    const staleData = await this.redisService.get<T>(staleKey);

    if (staleData) {
      return staleData;
    }

    throw new ServiceUnavailableException(
      'Data is loading. Please try again shortly.',
    );
  }

  async assertApiBudgetAllowsRequest(
    priority = ApiFootballRequestPriority.MEDIUM,
  ): Promise<void> {
    const usagePercent = await this.getUsagePercent();

    const softLimit = this.getNumberEnv('API_FOOTBALL_SOFT_LIMIT_PERCENT', 70);
    const lowPriorityCutoff = this.getNumberEnv(
      'API_FOOTBALL_LOW_PRIORITY_CUTOFF_PERCENT',
      85,
    );
    const hardLimit = this.getNumberEnv('API_FOOTBALL_HARD_LIMIT_PERCENT', 95);

    if (
      usagePercent >= hardLimit &&
      priority !== ApiFootballRequestPriority.HIGH
    ) {
      throw new ServiceUnavailableException(
        'API-Football daily limit is almost used. Only high-priority refresh is allowed.',
      );
    }

    if (
      usagePercent >= lowPriorityCutoff &&
      priority === ApiFootballRequestPriority.LOW
    ) {
      throw new ServiceUnavailableException(
        'API-Football low-priority refresh is paused.',
      );
    }

    if (usagePercent >= softLimit) {
      // For now, this is only a soft checkpoint.
      // Later we can use it to increase TTL dynamically.
      return;
    }
  }

  async getUsagePercent(): Promise<number> {
    const limit = this.getNumberEnv('API_FOOTBALL_DAILY_LIMIT', 75000);
    const date = new Date().toISOString().slice(0, 10);
    const key = `api-football:usage:${date}`;

    const rawValue = await this.redisService.getClient().get(key);
    const used = rawValue ? Number(rawValue) : 0;

    if (!limit || Number.isNaN(used)) {
      return 0;
    }

    return (used / limit) * 100;
  }

  async trackApiUsage(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const key = `api-football:usage:${date}`;

    await this.redisService.incrementDailyCounter(key, 60 * 60 * 48);
  }

  private async waitForFreshCache<T>(cacheKey: string): Promise<T | null> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.delay(200);

      const cachedData = await this.redisService.get<T>(cacheKey);

      if (cachedData) {
        return cachedData;
      }
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private getNumberEnv(key: string, fallback: number): number {
    const value = process.env[key];

    if (!value) {
      return fallback;
    }

    const parsedValue = Number(value);

    return Number.isNaN(parsedValue) ? fallback : parsedValue;
  }
}

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ApiFootballClient } from './api-football.client';

type QueryParams = Record<string, string | number | boolean | undefined>;

interface CachedApiOptions<T> {
  endpoint: string;
  params?: QueryParams;
  cacheKey: string;
  ttlSeconds: number;
  staleTtlSeconds: number;
  lockTtlSeconds?: number;
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

  private async trackApiUsage(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const key = `api-football:usage:${date}`;

    await this.redisService.incrementDailyCounter(key, 60 * 60 * 48);
  }
}

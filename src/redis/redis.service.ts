import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL is missing');
    }

    this.client = new Redis(redisUrl, {
      family: 0,
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(
          `Redis reconnection attempt ${times}, retrying in ${delay}ms`,
        );
        return delay;
      },
      connectTimeout: 30000,
      reconnectOnError: () => true,
    });

    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {
    this.client.on('error', (error) => {
      this.logger.error('Redis error:', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis ready');
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await new Promise((resolve) => {
        this.client.once('ready', () => {
          this.logger.log('Redis connected successfully');
          resolve(undefined);
        });
      });
    } catch (error) {
      this.logger.warn('Redis initialization warning:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis disconnected successfully');
    } catch (error) {
      this.logger.warn('Error disconnecting from Redis:', error);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async setLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async incrementDailyCounter(
    key: string,
    ttlSeconds: number,
  ): Promise<number> {
    const value = await this.client.incr(key);

    if (value === 1) {
      await this.client.expire(key, ttlSeconds);
    }

    return value;
  }
}

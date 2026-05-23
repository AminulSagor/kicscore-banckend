import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { RedisService } from 'src/redis/redis.service';
import { FootballTournamentSeasonsService } from '../football-tournament-seasons.service';
import { WorldCupHistorySeederService } from '../world-cup-history-seeder.service';

const DEFAULT_WORKER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WORKER_LOCK_TTL_SECONDS = 300;
const WORKER_LOCK_KEY = 'lock:football-history:world-cup-season-sync';

@Injectable()
export class WorldCupSeasonSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorldCupSeasonSyncWorker.name);

  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly tournamentSeasonsService: FootballTournamentSeasonsService,
    private readonly historySeederService: WorldCupHistorySeederService,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.WORLD_CUP_SEASON_SYNC_WORKER_ENABLED === 'true';

    if (!enabled) {
      this.logger.log('World Cup season sync worker disabled');
      return;
    }

    const intervalMs = Number(
      process.env.WORLD_CUP_SEASON_SYNC_WORKER_INTERVAL_MS ??
        DEFAULT_WORKER_INTERVAL_MS,
    );

    void this.run();

    this.timer = setInterval(() => {
      void this.run();
    }, intervalMs);

    this.logger.log(`World Cup season sync worker started: ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(): Promise<void> {
    if (process.env.WORLD_CUP_SEASON_SYNC_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    const hasLock = await this.redisService.setLock(
      WORKER_LOCK_KEY,
      WORKER_LOCK_TTL_SECONDS,
    );

    if (!hasLock) {
      return;
    }

    this.isRunning = true;

    try {
      const seededCount =
        await this.historySeederService.seedHistoricalSeasons();

      const importedApiSeasons =
        await this.tournamentSeasonsService.syncMissingApiSupportedSeasons();

      const currentSeasonSynced =
        await this.tournamentSeasonsService.syncCurrentSeasonIfDue();

      this.logger.log(
        `World Cup history sync completed. Seeded: ${seededCount}, API imports: ${importedApiSeasons}, Current season checked: ${currentSeasonSynced}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`World Cup history sync failed: ${message}`);
    } finally {
      this.isRunning = false;
      await this.redisService.del(WORKER_LOCK_KEY);
    }
  }
}

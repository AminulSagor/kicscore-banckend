import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlayerCareerSyncState } from '../entities/player-career-sync-state.entity';
import { PlayerCareerService } from '../player-career.service';

@Injectable()
export class PlayerCareerCacheWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlayerCareerCacheWorker.name);
  private isRunning = false;

  constructor(
    private readonly playerCareerService: PlayerCareerService,

    @InjectRepository(PlayerCareerSyncState)
    private readonly syncStateRepository: Repository<PlayerCareerSyncState>,
  ) {}

  onApplicationBootstrap(): void {
    const enabled = process.env.PLAYER_CAREER_WORKER_ENABLED === 'true';

    this.logger.log(
      enabled
        ? 'Player career cache worker enabled'
        : 'Player career cache worker disabled',
    );
  }

  @Cron(process.env.PLAYER_CAREER_REFRESH_CRON ?? '0 4 * * 0')
  async handleWeeklyRefresh(): Promise<void> {
    if (process.env.PLAYER_CAREER_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const states = await this.syncStateRepository.find({
        where: {
          initialSyncCompleted: true,
        },
        order: {
          lastSyncedAt: 'ASC',
        },
      });

      for (const state of states) {
        try {
          await this.playerCareerService.refreshWeeklyCachedCareer(
            state.playerId,
          );

          this.logger.log(
            `Player career refreshed. playerId=${state.playerId}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `Player career refresh failed. playerId=${state.playerId}, error=${message}`,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}

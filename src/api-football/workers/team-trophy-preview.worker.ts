import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FootballCompositeService } from '../football-composite.service';
import { TeamTrophyPreviewTarget } from '../entities/team-trophy-preview-target.entity';

@Injectable()
export class TeamTrophyPreviewWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(TeamTrophyPreviewWorker.name);
  private isRunning = false;

  constructor(
    private readonly footballCompositeService: FootballCompositeService,

    @InjectRepository(TeamTrophyPreviewTarget)
    private readonly targetRepository: Repository<TeamTrophyPreviewTarget>,
  ) {}

  onApplicationBootstrap(): void {
    const enabled = process.env.TEAM_TROPHY_PREVIEW_WORKER_ENABLED === 'true';

    this.logger.log(
      enabled
        ? 'Team trophy preview worker enabled'
        : 'Team trophy preview worker disabled',
    );
  }

  @Cron(process.env.TEAM_TROPHY_PREVIEW_WEEKLY_CRON ?? '0 3 * * 0')
  async handleWeeklyRefresh(): Promise<void> {
    if (process.env.TEAM_TROPHY_PREVIEW_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const targets = await this.targetRepository.find({
        where: {
          initialSyncCompleted: true,
        },
        order: {
          updatedAt: 'ASC',
        },
        take: Number(process.env.TEAM_TROPHY_PREVIEW_BATCH_SIZE ?? 3),
      });

      for (const target of targets) {
        try {
          const result =
            await this.footballCompositeService.syncTeamTrophyPreviewTarget(
              target.teamId,
            );

          this.logger.log(
            `Team trophy preview refreshed. teamId=${result.teamId}, from=${result.fromSeason}, to=${result.toSeason}, groups=${result.groupsSynced}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `Team trophy preview refresh failed. teamId=${target.teamId}, error=${message}`,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}

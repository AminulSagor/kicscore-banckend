import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FootballService } from 'src/api-football/football.service';
import { RedisService } from 'src/redis/redis.service';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FollowsService } from 'src/modules/follows/follows.service';
import { NotificationPriority } from 'src/notifications/enums/notification-priority.enum';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { FootballNotificationFanoutService } from '../football-notification-fanout.service';
import { FootballTransferNotificationSnapshot } from '../entities/football-transfer-notification-snapshot.entity';
import { FootballTransferTargetScan } from '../entities/football-transfer-target-scan.entity';

interface ApiFootballTransfersResponse {
  response?: ApiFootballTransferPlayer[];
}

interface ApiFootballTransferPlayer {
  player: {
    id: number | null;
    name: string | null;
  };
  update?: string | null;
  transfers?: ApiFootballTransferItem[];
}

interface ApiFootballTransferItem {
  date: string | null;
  type: string | null;
  teams: {
    in: {
      id: number | null;
      name: string | null;
      logo?: string | null;
    };
    out: {
      id: number | null;
      name: string | null;
      logo?: string | null;
    };
  };
}

interface TransferTarget {
  entityType: FollowEntityType.TEAM | FollowEntityType.PLAYER;
  entityId: string;
}

@Injectable()
export class TransferNotificationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TransferNotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly footballService: FootballService,
    private readonly redisService: RedisService,
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,
    private readonly fanoutService: FootballNotificationFanoutService,

    @InjectRepository(FootballTransferNotificationSnapshot)
    private readonly transferSnapshotRepository: Repository<FootballTransferNotificationSnapshot>,

    @InjectRepository(FootballTransferTargetScan)
    private readonly transferTargetScanRepository: Repository<FootballTransferTargetScan>,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.TRANSFER_NOTIFICATION_WORKER_ENABLED === 'true';

    if (!enabled) {
      this.logger.log('Transfer notification worker disabled');
      return;
    }

    const intervalMs = Number(
      process.env.TRANSFER_NOTIFICATION_WORKER_INTERVAL_MS ?? 86400000,
    );

    this.timer = setInterval(() => {
      void this.run();
    }, intervalMs);

    this.logger.log(`Transfer notification worker started: ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(): Promise<void> {
    if (process.env.TRANSFER_NOTIFICATION_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    const hasLock = await this.redisService.setLock(
      'lock:football-notifications:transfer-worker',
      300,
    );

    if (!hasLock) {
      return;
    }

    this.isRunning = true;

    try {
      const targets = await this.getUniqueTransferTargets();

      for (const target of targets) {
        await this.processTarget(target);
      }

      this.logger.log(`Transfer worker checked ${targets.length} targets`);
    } catch (error) {
      this.logger.error('Transfer worker failed', error as Error);
    } finally {
      this.isRunning = false;
      await this.redisService.del(
        'lock:football-notifications:transfer-worker',
      );
    }
  }

  private async getUniqueTransferTargets(): Promise<TransferTarget[]> {
    const follows = await this.followsService.findActiveFollowsByEntityTypes([
      FollowEntityType.TEAM,
      FollowEntityType.PLAYER,
    ]);

    const targetMap = new Map<string, TransferTarget>();

    for (const follow of follows) {
      if (
        follow.entityType !== FollowEntityType.TEAM &&
        follow.entityType !== FollowEntityType.PLAYER
      ) {
        continue;
      }

      const key = `${follow.entityType}:${follow.entityId}`;

      targetMap.set(key, {
        entityType: follow.entityType,
        entityId: follow.entityId,
      });
    }

    return Array.from(targetMap.values());
  }

  private async processTarget(target: TransferTarget): Promise<void> {
    const scan = await this.getOrCreateTargetScan(target);

    const data = (await this.footballService.getTransfers(
      target.entityType === FollowEntityType.TEAM
        ? { team: target.entityId }
        : { player: target.entityId },
    )) as ApiFootballTransfersResponse;

    const transferPlayers = data.response ?? [];

    for (const transferPlayer of transferPlayers) {
      const transfers = transferPlayer.transfers ?? [];

      for (const transfer of transfers) {
        await this.processTransferItem({
          target,
          transferPlayer,
          transfer,
          shouldNotify: scan.initialScanCompleted,
        });
      }
    }

    scan.initialScanCompleted = true;
    scan.lastCheckedAt = new Date();

    await this.transferTargetScanRepository.save(scan);
  }

  private async processTransferItem(params: {
    target: TransferTarget;
    transferPlayer: ApiFootballTransferPlayer;
    transfer: ApiFootballTransferItem;
    shouldNotify: boolean;
  }): Promise<void> {
    const playerId = params.transferPlayer.player.id
      ? String(params.transferPlayer.player.id)
      : null;

    const playerName = params.transferPlayer.player.name ?? 'A player';

    const fromTeamId = params.transfer.teams.out.id
      ? String(params.transfer.teams.out.id)
      : null;

    const toTeamId = params.transfer.teams.in.id
      ? String(params.transfer.teams.in.id)
      : null;

    const fromTeamName = params.transfer.teams.out.name ?? 'Unknown club';
    const toTeamName = params.transfer.teams.in.name ?? 'Unknown club';

    const transferDate = params.transfer.date;
    const transferType = params.transfer.type;

    const dedupeKey = this.buildTransferDedupeKey({
      target: params.target,
      playerId,
      transferDate,
      transferType,
      fromTeamId,
      toTeamId,
    });

    const existingSnapshot = await this.transferSnapshotRepository.findOne({
      where: {
        dedupeKey,
      },
    });

    if (existingSnapshot) {
      return;
    }

    const snapshot = this.transferSnapshotRepository.create({
      targetEntityType: params.target.entityType,
      targetEntityId: params.target.entityId,
      playerId,
      transferDate,
      transferType,
      fromTeamId,
      toTeamId,
      dedupeKey,
      notifiedAt: params.shouldNotify ? new Date() : null,
    });

    await this.transferSnapshotRepository.save(snapshot);

    if (!params.shouldNotify) {
      return;
    }

    await this.sendTransferNotification({
      target: params.target,
      playerId,
      playerName,
      fromTeamId,
      fromTeamName,
      toTeamId,
      toTeamName,
      transferDate,
      transferType,
      dedupeKey,
    });
  }

  private async sendTransferNotification(params: {
    target: TransferTarget;
    playerId: string | null;
    playerName: string;
    fromTeamId: string | null;
    fromTeamName: string;
    toTeamId: string | null;
    toTeamName: string;
    transferDate: string | null;
    transferType: string | null;
    dedupeKey: string;
  }): Promise<void> {
    const title = `Transfer update: ${params.playerName}`;
    const body = `${params.playerName} moved from ${params.fromTeamName} to ${params.toTeamName}`;
    const deepLink = params.playerId
      ? `/players/${params.playerId}?tab=career`
      : '/transfers';

    const event = await this.notificationsService.createEvent({
      eventType: NotificationType.TRANSFER_UPDATE,
      entityType: params.target.entityType,
      entityId: params.target.entityId,
      playerId: params.playerId,
      teamId:
        params.target.entityType === FollowEntityType.TEAM
          ? params.target.entityId
          : params.toTeamId,
      title,
      body,
      deepLink,
      priority: NotificationPriority.MEDIUM,
      dedupeKey: `transfer:${params.dedupeKey}`,
      data: {
        type: 'TRANSFER_UPDATE',
        playerId: params.playerId,
        fromTeamId: params.fromTeamId,
        toTeamId: params.toTeamId,
        transferDate: params.transferDate,
        transferType: params.transferType,
      },
    });

    const targets = this.buildFanoutTargets({
      target: params.target,
      playerId: params.playerId,
      fromTeamId: params.fromTeamId,
      toTeamId: params.toTeamId,
    });

    await this.fanoutService.sendToFollowers({
      targets,
      notificationEvent: event,
      title,
      body,
      deepLink,
      data: {
        type: 'TRANSFER_UPDATE',
        playerId: params.playerId,
        fromTeamId: params.fromTeamId,
        toTeamId: params.toTeamId,
      },
    });
  }

  private buildFanoutTargets(params: {
    target: TransferTarget;
    playerId: string | null;
    fromTeamId: string | null;
    toTeamId: string | null;
  }): Array<{
    entityType: FollowEntityType;
    entityId: string;
  }> {
    const targets = new Map<
      string,
      { entityType: FollowEntityType; entityId: string }
    >();

    targets.set(`${params.target.entityType}:${params.target.entityId}`, {
      entityType: params.target.entityType,
      entityId: params.target.entityId,
    });

    if (params.playerId) {
      targets.set(`${FollowEntityType.PLAYER}:${params.playerId}`, {
        entityType: FollowEntityType.PLAYER,
        entityId: params.playerId,
      });
    }

    if (params.fromTeamId) {
      targets.set(`${FollowEntityType.TEAM}:${params.fromTeamId}`, {
        entityType: FollowEntityType.TEAM,
        entityId: params.fromTeamId,
      });
    }

    if (params.toTeamId) {
      targets.set(`${FollowEntityType.TEAM}:${params.toTeamId}`, {
        entityType: FollowEntityType.TEAM,
        entityId: params.toTeamId,
      });
    }

    return Array.from(targets.values());
  }

  private buildTransferDedupeKey(params: {
    target: TransferTarget;
    playerId: string | null;
    transferDate: string | null;
    transferType: string | null;
    fromTeamId: string | null;
    toTeamId: string | null;
  }): string {
    return [
      params.target.entityType,
      params.target.entityId,
      params.playerId ?? 'unknown-player',
      params.transferDate ?? 'unknown-date',
      params.transferType ?? 'unknown-type',
      params.fromTeamId ?? 'unknown-from',
      params.toTeamId ?? 'unknown-to',
    ]
      .map((part) => part.replace(/\s+/g, '-').toLowerCase())
      .join(':');
  }

  private async getOrCreateTargetScan(
    target: TransferTarget,
  ): Promise<FootballTransferTargetScan> {
    const existingScan = await this.transferTargetScanRepository.findOne({
      where: {
        entityType: target.entityType,
        entityId: target.entityId,
      },
    });

    if (existingScan) {
      return existingScan;
    }

    return this.transferTargetScanRepository.save(
      this.transferTargetScanRepository.create({
        entityType: target.entityType,
        entityId: target.entityId,
        initialScanCompleted: false,
        lastCheckedAt: null,
      }),
    );
  }
}

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
import { FootballInjuryNotificationSnapshot } from '../entities/football-injury-notification-snapshot.entity';
import { FootballInjuryTargetScan } from '../entities/football-injury-target-scan.entity';

interface ApiFootballInjuriesResponse {
  response?: ApiFootballInjuryItem[];
}

interface ApiFootballInjuryItem {
  player: {
    id: number | null;
    name: string | null;
    type: string | null;
    reason: string | null;
  };
  team: {
    id: number | null;
    name: string | null;
  };
  fixture: {
    id: number | null;
    date: string | null;
  };
  league: {
    id: number | null;
    name: string | null;
    season: number | null;
  };
}

interface InjuryTarget {
  entityType: FollowEntityType.TEAM | FollowEntityType.PLAYER;
  entityId: string;
}

@Injectable()
export class InjuryNotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InjuryNotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly footballService: FootballService,
    private readonly redisService: RedisService,
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,
    private readonly fanoutService: FootballNotificationFanoutService,

    @InjectRepository(FootballInjuryNotificationSnapshot)
    private readonly injurySnapshotRepository: Repository<FootballInjuryNotificationSnapshot>,

    @InjectRepository(FootballInjuryTargetScan)
    private readonly injuryTargetScanRepository: Repository<FootballInjuryTargetScan>,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.INJURY_NOTIFICATION_WORKER_ENABLED === 'true';

    if (!enabled) {
      this.logger.log('Injury notification worker disabled');
      return;
    }

    const intervalMs = Number(
      process.env.INJURY_NOTIFICATION_WORKER_INTERVAL_MS ?? 86400000,
    );

    this.timer = setInterval(() => {
      void this.run();
    }, intervalMs);

    this.logger.log(`Injury notification worker started: ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(): Promise<void> {
    if (process.env.INJURY_NOTIFICATION_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    const hasLock = await this.redisService.setLock(
      'lock:football-notifications:injury-worker',
      300,
    );

    if (!hasLock) {
      return;
    }

    this.isRunning = true;

    try {
      const targets = await this.getUniqueInjuryTargets();

      for (const target of targets) {
        await this.processTarget(target);
      }

      this.logger.log(`Injury worker checked ${targets.length} targets`);
    } catch (error) {
      this.logger.error('Injury worker failed', error as Error);
    } finally {
      this.isRunning = false;
      await this.redisService.del('lock:football-notifications:injury-worker');
    }
  }

  private async getUniqueInjuryTargets(): Promise<InjuryTarget[]> {
    const follows = await this.followsService.findActiveFollowsByEntityTypes([
      FollowEntityType.TEAM,
      FollowEntityType.PLAYER,
    ]);

    const targetMap = new Map<string, InjuryTarget>();

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

  private async processTarget(target: InjuryTarget): Promise<void> {
    const scan = await this.getOrCreateTargetScan(target);
    const seasonCandidates = this.getInjurySeasonCandidates();

    for (const season of seasonCandidates) {
      const query = this.buildInjuryQuery({
        target,
        season,
      });

      const data = (await this.footballService.getInjuries(
        query,
      )) as ApiFootballInjuriesResponse;

      const injuries = data.response ?? [];

      for (const injury of injuries) {
        await this.processInjuryItem({
          target,
          injury,
          season,
          shouldNotify: scan.initialScanCompleted,
        });
      }
    }

    scan.initialScanCompleted = true;
    scan.lastCheckedAt = new Date();

    await this.injuryTargetScanRepository.save(scan);
  }

  private getInjurySeasonCandidates(): string[] {
    const overrideSeason = process.env.INJURY_NOTIFICATION_SEASON_OVERRIDE;

    if (overrideSeason) {
      return [overrideSeason];
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const europeanSeason = currentMonth >= 8 ? currentYear : currentYear - 1;
    const calendarYearSeason = currentYear;

    return Array.from(
      new Set([String(europeanSeason), String(calendarYearSeason)]),
    );
  }

  private buildInjuryQuery(params: {
    target: InjuryTarget;
    season: string;
  }): Record<string, string | number | boolean | undefined> {
    if (params.target.entityType === FollowEntityType.TEAM) {
      return {
        team: params.target.entityId,
        season: params.season,
      };
    }

    return {
      player: params.target.entityId,
      season: params.season,
    };
  }

  private async processInjuryItem(params: {
    target: InjuryTarget;
    injury: ApiFootballInjuryItem;
    season: string;
    shouldNotify: boolean;
  }): Promise<void> {
    const playerId = params.injury.player.id
      ? String(params.injury.player.id)
      : null;

    const teamId = params.injury.team.id ? String(params.injury.team.id) : null;

    const fixtureId = params.injury.fixture.id
      ? String(params.injury.fixture.id)
      : null;

    const leagueId = params.injury.league.id
      ? String(params.injury.league.id)
      : null;

    const injuryType = params.injury.player.type;
    const injuryReason = params.injury.player.reason;
    const fixtureDate = params.injury.fixture.date;
    const playerName = params.injury.player.name ?? 'A player';
    const teamName = params.injury.team.name ?? 'Team';

    const dedupeKey = this.buildInjuryDedupeKey({
      target: params.target,
      season: params.season,
      playerId,
      teamId,
      fixtureId,
      injuryType,
      injuryReason,
      fixtureDate,
    });

    const existingSnapshot = await this.injurySnapshotRepository.findOne({
      where: {
        dedupeKey,
      },
    });

    if (existingSnapshot) {
      return;
    }

    const snapshot = this.injurySnapshotRepository.create({
      targetEntityType: params.target.entityType,
      targetEntityId: params.target.entityId,
      playerId,
      teamId,
      fixtureId,
      leagueId,
      injuryType,
      injuryReason,
      fixtureDate,
      dedupeKey,
      notifiedAt: params.shouldNotify ? new Date() : null,
    });

    await this.injurySnapshotRepository.save(snapshot);

    if (!params.shouldNotify) {
      return;
    }

    await this.sendInjuryNotification({
      target: params.target,
      playerId,
      playerName,
      teamId,
      teamName,
      fixtureId,
      leagueId,
      injuryType,
      injuryReason,
      dedupeKey,
    });
  }

  private async sendInjuryNotification(params: {
    target: InjuryTarget;
    playerId: string | null;
    playerName: string;
    teamId: string | null;
    teamName: string;
    fixtureId: string | null;
    leagueId: string | null;
    injuryType: string | null;
    injuryReason: string | null;
    dedupeKey: string;
  }): Promise<void> {
    const title = `Injury update: ${params.teamName}`;
    const reasonText =
      params.injuryReason ?? params.injuryType ?? 'unavailable';
    const body = `${params.playerName} is listed as ${reasonText}`;

    const deepLink = params.fixtureId
      ? `/matches/${params.fixtureId}?tab=facts`
      : params.playerId
        ? `/players/${params.playerId}`
        : '/notifications';

    const event = await this.notificationsService.createEvent({
      eventType: NotificationType.INJURY_UPDATE,
      entityType: params.target.entityType,
      entityId: params.target.entityId,
      fixtureId: params.fixtureId,
      teamId: params.teamId,
      playerId: params.playerId,
      leagueId: params.leagueId,
      title,
      body,
      deepLink,
      priority: NotificationPriority.MEDIUM,
      dedupeKey: `injury:${params.dedupeKey}`,
      data: {
        type: 'INJURY_UPDATE',
        playerId: params.playerId,
        teamId: params.teamId,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
        injuryType: params.injuryType,
        injuryReason: params.injuryReason,
      },
    });

    const targets = this.buildFanoutTargets({
      target: params.target,
      playerId: params.playerId,
      teamId: params.teamId,
    });

    await this.fanoutService.sendToFollowers({
      targets,
      notificationEvent: event,
      title,
      body,
      deepLink,
      data: {
        type: 'INJURY_UPDATE',
        playerId: params.playerId,
        teamId: params.teamId,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
      },
    });
  }

  private buildFanoutTargets(params: {
    target: InjuryTarget;
    playerId: string | null;
    teamId: string | null;
  }): Array<{
    entityType: FollowEntityType;
    entityId: string;
  }> {
    const targets = new Map<
      string,
      {
        entityType: FollowEntityType;
        entityId: string;
      }
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

    if (params.teamId) {
      targets.set(`${FollowEntityType.TEAM}:${params.teamId}`, {
        entityType: FollowEntityType.TEAM,
        entityId: params.teamId,
      });
    }

    return Array.from(targets.values());
  }

  private buildInjuryDedupeKey(params: {
    target: InjuryTarget;
    season: string;
    playerId: string | null;
    teamId: string | null;
    fixtureId: string | null;
    injuryType: string | null;
    injuryReason: string | null;
    fixtureDate: string | null;
  }): string {
    return [
      params.target.entityType,
      params.target.entityId,
      params.season,
      params.playerId ?? 'unknown-player',
      params.teamId ?? 'unknown-team',
      params.fixtureId ?? 'unknown-fixture',
      params.injuryType ?? 'unknown-type',
      params.injuryReason ?? 'unknown-reason',
      params.fixtureDate ?? 'unknown-date',
    ]
      .map((part) => part.replace(/\s+/g, '-').toLowerCase())
      .join(':');
  }

  private async getOrCreateTargetScan(
    target: InjuryTarget,
  ): Promise<FootballInjuryTargetScan> {
    const existingScan = await this.injuryTargetScanRepository.findOne({
      where: {
        entityType: target.entityType,
        entityId: target.entityId,
      },
    });

    if (existingScan) {
      return existingScan;
    }

    return this.injuryTargetScanRepository.save(
      this.injuryTargetScanRepository.create({
        entityType: target.entityType,
        entityId: target.entityId,
        initialScanCompleted: false,
        lastCheckedAt: null,
      }),
    );
  }
}

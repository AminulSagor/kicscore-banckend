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
import { FootballStandingsTargetScan } from '../entities/football-standings-target-scan.entity';
import { FootballStandingsTeamSnapshot } from '../entities/football-standings-team-snapshot.entity';

interface ApiFootballStandingsResponse {
  response?: ApiFootballStandingLeagueBlock[];
}

interface ApiFootballStandingLeagueBlock {
  league: {
    id: number;
    name: string;
    season: number;
    standings: ApiFootballStandingRow[][];
  };
}

interface ApiFootballStandingRow {
  rank: number;
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  points: number;
  goalsDiff: number;
  group?: string | null;
  form?: string | null;
  status?: string | null;
  description?: string | null;
}

interface StandingTarget {
  leagueId: string;
  season: string;
}

@Injectable()
export class TableChangeNotificationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TableChangeNotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly footballService: FootballService,
    private readonly redisService: RedisService,
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,
    private readonly fanoutService: FootballNotificationFanoutService,

    @InjectRepository(FootballStandingsTargetScan)
    private readonly standingsTargetScanRepository: Repository<FootballStandingsTargetScan>,

    @InjectRepository(FootballStandingsTeamSnapshot)
    private readonly standingsTeamSnapshotRepository: Repository<FootballStandingsTeamSnapshot>,
  ) {}

  onModuleInit(): void {
    const enabled =
      process.env.TABLE_CHANGE_NOTIFICATION_WORKER_ENABLED === 'true';

    if (!enabled) {
      this.logger.log('Table change notification worker disabled');
      return;
    }

    const intervalMs = Number(
      process.env.TABLE_CHANGE_NOTIFICATION_WORKER_INTERVAL_MS ?? 21600000,
    );

    this.timer = setInterval(() => {
      void this.run();
    }, intervalMs);

    this.logger.log(
      `Table change notification worker started: ${intervalMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(): Promise<void> {
    if (process.env.TABLE_CHANGE_NOTIFICATION_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    const hasLock = await this.redisService.setLock(
      'lock:football-notifications:table-change-worker',
      600,
    );

    if (!hasLock) {
      return;
    }

    this.isRunning = true;

    try {
      const targets = await this.getUniqueStandingTargets();

      for (const target of targets) {
        await this.processTarget(target);
      }

      this.logger.log(`Table change worker checked ${targets.length} targets`);
    } catch (error) {
      this.logger.error('Table change worker failed', error as Error);
    } finally {
      this.isRunning = false;
      await this.redisService.del(
        'lock:football-notifications:table-change-worker',
      );
    }
  }

  private async getUniqueStandingTargets(): Promise<StandingTarget[]> {
    const follows = await this.followsService.findActiveFollowsByEntityTypes([
      FollowEntityType.LEAGUE,
      FollowEntityType.TEAM,
    ]);

    const targetMap = new Map<string, StandingTarget>();
    const seasonCandidates = this.getSeasonCandidates();

    for (const follow of follows) {
      if (follow.entityType === FollowEntityType.LEAGUE) {
        const seasonFromMetadata = this.getMetadataValue(follow, 'season');
        const seasons = seasonFromMetadata
          ? [seasonFromMetadata]
          : seasonCandidates;

        for (const season of seasons) {
          const key = `${follow.entityId}:${season}`;

          targetMap.set(key, {
            leagueId: follow.entityId,
            season,
          });
        }
      }

      if (follow.entityType === FollowEntityType.TEAM) {
        const leagueId = this.getMetadataValue(follow, 'leagueId');
        const seasonFromMetadata = this.getMetadataValue(follow, 'season');

        if (!leagueId) {
          continue;
        }

        const seasons = seasonFromMetadata
          ? [seasonFromMetadata]
          : seasonCandidates;

        for (const season of seasons) {
          const key = `${leagueId}:${season}`;

          targetMap.set(key, {
            leagueId,
            season,
          });
        }
      }
    }

    return Array.from(targetMap.values());
  }

  private async processTarget(target: StandingTarget): Promise<void> {
    const scan = await this.getOrCreateTargetScan(target);

    const data = (await this.footballService.getStandings({
      league: target.leagueId,
      season: target.season,
    })) as ApiFootballStandingsResponse;

    const leagueBlock = data.response?.[0];

    if (!leagueBlock?.league?.standings?.length) {
      scan.initialScanCompleted = true;
      scan.lastCheckedAt = new Date();

      await this.standingsTargetScanRepository.save(scan);
      return;
    }

    const standingsRows = leagueBlock.league.standings.flat();

    for (const row of standingsRows) {
      await this.processStandingRow({
        target,
        row,
        shouldNotify: scan.initialScanCompleted,
      });
    }

    scan.initialScanCompleted = true;
    scan.lastCheckedAt = new Date();

    await this.standingsTargetScanRepository.save(scan);
  }

  private async processStandingRow(params: {
    target: StandingTarget;
    row: ApiFootballStandingRow;
    shouldNotify: boolean;
  }): Promise<void> {
    const teamId = String(params.row.team.id);
    const teamName = params.row.team.name;

    let snapshot = await this.standingsTeamSnapshotRepository.findOne({
      where: {
        leagueId: params.target.leagueId,
        season: params.target.season,
        teamId,
      },
    });

    if (!snapshot) {
      snapshot = this.standingsTeamSnapshotRepository.create({
        leagueId: params.target.leagueId,
        season: params.target.season,
        teamId,
        teamName,
        rank: params.row.rank,
        points: params.row.points,
        goalsDiff: params.row.goalsDiff ?? 0,
        form: params.row.form ?? null,
        description: params.row.description ?? null,
        lastCheckedAt: new Date(),
      });

      await this.standingsTeamSnapshotRepository.save(snapshot);
      return;
    }

    const rankChanged = snapshot.rank !== params.row.rank;
    const pointsChanged = snapshot.points !== params.row.points;
    const goalsDiffChanged = snapshot.goalsDiff !== (params.row.goalsDiff ?? 0);

    if (
      params.shouldNotify &&
      (rankChanged || pointsChanged || goalsDiffChanged)
    ) {
      await this.sendTableChangeNotification({
        target: params.target,
        teamId,
        teamName,
        oldRank: snapshot.rank,
        newRank: params.row.rank,
        oldPoints: snapshot.points,
        newPoints: params.row.points,
        oldGoalsDiff: snapshot.goalsDiff,
        newGoalsDiff: params.row.goalsDiff ?? 0,
      });
    }

    snapshot.teamName = teamName;
    snapshot.rank = params.row.rank;
    snapshot.points = params.row.points;
    snapshot.goalsDiff = params.row.goalsDiff ?? 0;
    snapshot.form = params.row.form ?? null;
    snapshot.description = params.row.description ?? null;
    snapshot.lastCheckedAt = new Date();

    await this.standingsTeamSnapshotRepository.save(snapshot);
  }

  private async sendTableChangeNotification(params: {
    target: StandingTarget;
    teamId: string;
    teamName: string;
    oldRank: number;
    newRank: number;
    oldPoints: number;
    newPoints: number;
    oldGoalsDiff: number;
    newGoalsDiff: number;
  }): Promise<void> {
    const rankDirection =
      params.newRank < params.oldRank
        ? `moved up to ${params.newRank}`
        : `moved down to ${params.newRank}`;

    const title = `Table update: ${params.teamName}`;
    const body = `${params.teamName} ${rankDirection}. Points: ${params.newPoints}`;
    const deepLink = `/leagues/${params.target.leagueId}?tab=table&season=${params.target.season}`;

    const dedupeKey = [
      'table-change',
      params.target.leagueId,
      params.target.season,
      params.teamId,
      params.newRank,
      params.newPoints,
      params.newGoalsDiff,
    ].join(':');

    const event = await this.notificationsService.createEvent({
      eventType: NotificationType.TABLE_CHANGE,
      entityType: FollowEntityType.TEAM,
      entityId: params.teamId,
      teamId: params.teamId,
      leagueId: params.target.leagueId,
      title,
      body,
      deepLink,
      priority: NotificationPriority.MEDIUM,
      dedupeKey,
      data: {
        type: 'TABLE_CHANGE',
        teamId: params.teamId,
        leagueId: params.target.leagueId,
        season: params.target.season,
        oldRank: params.oldRank,
        newRank: params.newRank,
        oldPoints: params.oldPoints,
        newPoints: params.newPoints,
        oldGoalsDiff: params.oldGoalsDiff,
        newGoalsDiff: params.newGoalsDiff,
      },
    });

    await this.fanoutService.sendToFollowers({
      targets: [
        {
          entityType: FollowEntityType.TEAM,
          entityId: params.teamId,
        },
        {
          entityType: FollowEntityType.LEAGUE,
          entityId: params.target.leagueId,
        },
      ],
      notificationEvent: event,
      title,
      body,
      deepLink,
      data: {
        type: 'TABLE_CHANGE',
        teamId: params.teamId,
        leagueId: params.target.leagueId,
        season: params.target.season,
      },
    });
  }

  private async getOrCreateTargetScan(
    target: StandingTarget,
  ): Promise<FootballStandingsTargetScan> {
    const existingScan = await this.standingsTargetScanRepository.findOne({
      where: {
        leagueId: target.leagueId,
        season: target.season,
      },
    });

    if (existingScan) {
      return existingScan;
    }

    return this.standingsTargetScanRepository.save(
      this.standingsTargetScanRepository.create({
        leagueId: target.leagueId,
        season: target.season,
        initialScanCompleted: false,
        lastCheckedAt: null,
      }),
    );
  }

  private getSeasonCandidates(): string[] {
    const overrideSeason =
      process.env.TABLE_CHANGE_NOTIFICATION_SEASON_OVERRIDE;

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

  private getMetadataValue(
    follow: {
      metadataItems?: Array<{
        key: string;
        value: string;
      }>;
    },
    key: string,
  ): string | null {
    const item = follow.metadataItems?.find((metadataItem) => {
      return metadataItem.key === key;
    });

    return item?.value ?? null;
  }
}

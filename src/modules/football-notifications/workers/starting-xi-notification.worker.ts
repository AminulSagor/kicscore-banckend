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
import { FootballLineupNotificationSnapshot } from '../entities/football-lineup-notification-snapshot.entity';

interface ApiFootballFixturesResponse {
  response?: ApiFootballFixture[];
}

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      short: string;
    };
  };
  league: {
    id: number;
    name: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
    };
    away: {
      id: number;
      name: string;
    };
  };
}

interface ApiFootballLineupsResponse {
  response?: unknown[];
}

@Injectable()
export class StartingXiNotificationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(StartingXiNotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly footballService: FootballService,
    private readonly redisService: RedisService,
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,
    private readonly fanoutService: FootballNotificationFanoutService,

    @InjectRepository(FootballLineupNotificationSnapshot)
    private readonly lineupSnapshotRepository: Repository<FootballLineupNotificationSnapshot>,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.LINEUP_NOTIFICATION_WORKER_ENABLED === 'true';

    if (!enabled) {
      this.logger.log('Starting XI notification worker disabled');
      return;
    }

    const intervalMs = Number(
      process.env.LINEUP_NOTIFICATION_WORKER_INTERVAL_MS ?? 600000,
    );

    this.timer = setInterval(() => {
      void this.run();
    }, intervalMs);

    this.logger.log(`Starting XI notification worker started: ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(): Promise<void> {
    if (process.env.LINEUP_NOTIFICATION_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    const hasLock = await this.redisService.setLock(
      'lock:football-notifications:starting-xi-worker',
      60,
    );

    if (!hasLock) {
      return;
    }

    this.isRunning = true;

    try {
      const fixtures = await this.getFollowedUpcomingFixtures();

      for (const fixture of fixtures) {
        await this.processFixture(fixture);
      }
    } catch (error) {
      this.logger.error('Starting XI worker failed', error as Error);
    } finally {
      this.isRunning = false;
      await this.redisService.del(
        'lock:football-notifications:starting-xi-worker',
      );
    }
  }

  private async getFollowedUpcomingFixtures(): Promise<ApiFootballFixture[]> {
    const timezone = process.env.LINEUP_NOTIFICATION_TIMEZONE ?? 'Asia/Dhaka';
    const lookaheadMinutes = Number(
      process.env.LINEUP_NOTIFICATION_LOOKAHEAD_MINUTES ?? 90,
    );

    const now = new Date();
    const until = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

    const dates = new Set([
      this.formatDateInTimezone(now, timezone),
      this.formatDateInTimezone(until, timezone),
    ]);

    const activeFollows =
      await this.followsService.findActiveFollowsByEntityTypes([
        FollowEntityType.FIXTURE,
        FollowEntityType.TEAM,
        FollowEntityType.LEAGUE,
      ]);

    if (!activeFollows.length) {
      return [];
    }

    const followedFixtureIds = new Set<string>();
    const followedTeamIds = new Set<string>();
    const followedLeagueIds = new Set<string>();

    for (const follow of activeFollows) {
      if (follow.entityType === FollowEntityType.FIXTURE) {
        followedFixtureIds.add(follow.entityId);
      }

      if (follow.entityType === FollowEntityType.TEAM) {
        followedTeamIds.add(follow.entityId);
      }

      if (follow.entityType === FollowEntityType.LEAGUE) {
        followedLeagueIds.add(follow.entityId);
      }
    }

    const result: ApiFootballFixture[] = [];

    for (const date of dates) {
      const data = (await this.footballService.getFixtures({
        date,
        timezone,
      })) as ApiFootballFixturesResponse;

      const fixtures = data.response ?? [];

      for (const fixture of fixtures) {
        const fixtureId = String(fixture.fixture.id);
        const leagueId = String(fixture.league.id);
        const homeTeamId = String(fixture.teams.home.id);
        const awayTeamId = String(fixture.teams.away.id);
        const kickoffTime = new Date(fixture.fixture.date).getTime();
        const statusShort = fixture.fixture.status.short;

        const isUpcoming = ['NS', 'TBD'].includes(statusShort);
        const isInsideWindow =
          kickoffTime >= now.getTime() && kickoffTime <= until.getTime();

        const isFollowed =
          followedFixtureIds.has(fixtureId) ||
          followedLeagueIds.has(leagueId) ||
          followedTeamIds.has(homeTeamId) ||
          followedTeamIds.has(awayTeamId);

        if (isUpcoming && isInsideWindow && isFollowed) {
          result.push(fixture);
        }
      }
    }

    return result;
  }

  private async processFixture(fixture: ApiFootballFixture): Promise<void> {
    const fixtureId = String(fixture.fixture.id);
    const leagueId = String(fixture.league.id);
    const homeTeamId = String(fixture.teams.home.id);
    const awayTeamId = String(fixture.teams.away.id);

    let snapshot = await this.lineupSnapshotRepository.findOne({
      where: {
        fixtureId,
      },
    });

    if (snapshot?.notifiedAt) {
      return;
    }

    const lineups = (await this.footballService.getFixtureLineups(
      fixtureId,
    )) as ApiFootballLineupsResponse;

    const lineupAvailable =
      Array.isArray(lineups.response) && lineups.response.length > 0;

    if (!snapshot) {
      snapshot = this.lineupSnapshotRepository.create({
        fixtureId,
        leagueId,
        homeTeamId,
        awayTeamId,
        lineupAvailable,
        lastCheckedAt: new Date(),
      });
    }

    snapshot.lineupAvailable = lineupAvailable;
    snapshot.lastCheckedAt = new Date();

    if (!lineupAvailable) {
      await this.lineupSnapshotRepository.save(snapshot);
      return;
    }

    try {
      await this.sendLineupNotification({
        fixture,
        fixtureId,
        leagueId,
      });

      snapshot.notifiedAt = new Date();
    } catch (error) {
      this.logger.error('Failed to send lineup notification', error as Error);
    }

    await this.lineupSnapshotRepository.save(snapshot);
  }

  private async sendLineupNotification(params: {
    fixture: ApiFootballFixture;
    fixtureId: string;
    leagueId: string;
  }): Promise<void> {
    const title = 'Lineups are out';
    const body = `${params.fixture.teams.home.name} vs ${params.fixture.teams.away.name}`;
    const deepLink = `/matches/${params.fixtureId}?tab=lineup`;

    const event = await this.notificationsService.createEvent({
      eventType: NotificationType.LINEUP_AVAILABLE,
      entityType: FollowEntityType.FIXTURE,
      entityId: params.fixtureId,
      fixtureId: params.fixtureId,
      leagueId: params.leagueId,
      title,
      body,
      deepLink,
      priority: NotificationPriority.HIGH,
      dedupeKey: `lineup:${params.fixtureId}`,
      data: {
        type: 'LINEUP_AVAILABLE',
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
      },
    });

    await this.fanoutService.sendToFollowers({
      targets: [
        {
          entityType: FollowEntityType.FIXTURE,
          entityId: params.fixtureId,
        },
        {
          entityType: FollowEntityType.TEAM,
          entityId: String(params.fixture.teams.home.id),
        },
        {
          entityType: FollowEntityType.TEAM,
          entityId: String(params.fixture.teams.away.id),
        },
        {
          entityType: FollowEntityType.LEAGUE,
          entityId: params.leagueId,
        },
      ],
      notificationEvent: event,
      title,
      body,
      deepLink,
      data: {
        type: 'LINEUP_AVAILABLE',
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
      },
    });
  }

  private formatDateInTimezone(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(date);
  }
}

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
import { NotificationPriority } from 'src/notifications/enums/notification-priority.enum';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { FootballNotificationFanoutService } from '../football-notification-fanout.service';
import { FootballFixtureNotificationSnapshot } from '../entities/football-fixture-notification-snapshot.entity';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { FootballFixtureEventNotificationSnapshot } from '../entities/football-fixture-event-notification-snapshot.entity';

interface ApiFootballLiveFixturesResponse {
  response?: ApiFootballFixture[];
}

interface ApiFootballFixtureEvent {
  time: {
    elapsed: number | null;
    extra: number | null;
  };
  team: {
    id: number | null;
    name: string | null;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

interface ApiFootballFixture {
  fixture: {
    id: number;
    status: {
      short: string;
      elapsed: number | null;
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
  goals: {
    home: number | null;
    away: number | null;
  };
  events?: ApiFootballFixtureEvent[];
}

@Injectable()
export class LiveFixtureNotificationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LiveFixtureNotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly footballService: FootballService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly fanoutService: FootballNotificationFanoutService,

    @InjectRepository(FootballFixtureNotificationSnapshot)
    private readonly snapshotRepository: Repository<FootballFixtureNotificationSnapshot>,
    @InjectRepository(FootballFixtureEventNotificationSnapshot)
    private readonly eventSnapshotRepository: Repository<FootballFixtureEventNotificationSnapshot>,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.GOAL_NOTIFICATION_WORKER_ENABLED === 'true';

    if (!enabled) {
      this.logger.log('Live fixture notification worker disabled');
      return;
    }

    const intervalMs = Number(
      process.env.GOAL_NOTIFICATION_WORKER_INTERVAL_MS ?? 30000,
    );

    this.timer = setInterval(() => {
      void this.run();
    }, intervalMs);

    this.logger.log(
      `Live fixture notification worker started: ${intervalMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(): Promise<void> {
    if (process.env.GOAL_NOTIFICATION_WORKER_ENABLED !== 'true') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    const hasLock = await this.redisService.setLock(
      'lock:football-notifications:live-fixture-worker',
      25,
    );

    if (!hasLock) {
      return;
    }

    this.isRunning = true;

    try {
      const data =
        (await this.footballService.getLiveFixtures()) as ApiFootballLiveFixturesResponse;

      const fixtures = data.response ?? [];

      for (const fixture of fixtures) {
        await this.processFixture(fixture);
      }
    } catch (error) {
      this.logger.error('Live fixture worker failed', error as Error);
    } finally {
      this.isRunning = false;
      await this.redisService.del(
        'lock:football-notifications:live-fixture-worker',
      );
    }
  }

  private async processCardEvents(params: {
    fixture: ApiFootballFixture;
    fixtureId: string;
    leagueId: string;
  }): Promise<void> {
    const events = params.fixture.events ?? [];

    for (const event of events) {
      if (event.type !== 'Card') {
        continue;
      }

      const detail = event.detail;

      const isYellowCard = detail === 'Yellow Card';
      const isRedCard = detail === 'Red Card';
      const isSecondYellowCard = detail === 'Second Yellow Card';

      if (!isYellowCard && !isRedCard && !isSecondYellowCard) {
        continue;
      }

      const teamId = event.team.id ? String(event.team.id) : null;
      const playerId = event.player.id ? String(event.player.id) : null;
      const elapsed = event.time.elapsed;
      const extra = event.time.extra;

      if (!teamId) {
        continue;
      }

      const dedupeKey = this.buildCardDedupeKey({
        fixtureId: params.fixtureId,
        teamId,
        playerId,
        elapsed,
        extra,
        detail,
      });

      const existingSnapshot = await this.eventSnapshotRepository.findOne({
        where: {
          dedupeKey,
        },
      });

      if (existingSnapshot) {
        continue;
      }

      await this.sendCardNotification({
        fixture: params.fixture,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
        teamId,
        teamName: event.team.name ?? 'Team',
        playerName: event.player.name,
        elapsed,
        extra,
        detail,
        isYellowCard,
        isRedCard,
        isSecondYellowCard,
      });

      await this.eventSnapshotRepository.save(
        this.eventSnapshotRepository.create({
          fixtureId: params.fixtureId,
          eventType: event.type,
          eventDetail: detail,
          teamId,
          playerId,
          elapsed,
          extra,
          dedupeKey,
          notifiedAt: new Date(),
        }),
      );
    }
  }

  private buildCardDedupeKey(params: {
    fixtureId: string;
    teamId: string;
    playerId: string | null;
    elapsed: number | null;
    extra: number | null;
    detail: string;
  }): string {
    return [
      'card',
      params.fixtureId,
      params.teamId,
      params.playerId ?? 'unknown-player',
      params.elapsed ?? 'unknown-minute',
      params.extra ?? 0,
      params.detail.replace(/\s+/g, '-').toLowerCase(),
    ].join(':');
  }

  private async sendCardNotification(params: {
    fixture: ApiFootballFixture;
    fixtureId: string;
    leagueId: string;
    teamId: string;
    teamName: string;
    playerName: string | null;
    elapsed: number | null;
    extra: number | null;
    detail: string;
    isYellowCard: boolean;
    isRedCard: boolean;
    isSecondYellowCard: boolean;
  }): Promise<void> {
    const minute = this.formatEventMinute(params.elapsed, params.extra);
    const playerName = params.playerName ?? 'A player';

    const title = params.isYellowCard
      ? `Yellow card for ${params.teamName}`
      : `Red card for ${params.teamName}`;

    const body = params.isYellowCard
      ? `${playerName} received a yellow card${minute ? ` at ${minute}` : ''}`
      : `${playerName} was sent off${minute ? ` at ${minute}` : ''}`;

    const deepLink = `/matches/${params.fixtureId}?tab=facts`;

    const eventType = params.isYellowCard
      ? NotificationType.YELLOW_CARD
      : NotificationType.RED_CARD;

    const notificationEvent = await this.notificationsService.createEvent({
      eventType,
      entityType: FollowEntityType.TEAM,
      entityId: params.teamId,
      fixtureId: params.fixtureId,
      teamId: params.teamId,
      leagueId: params.leagueId,
      title,
      body,
      deepLink,
      priority: params.isYellowCard
        ? NotificationPriority.MEDIUM
        : NotificationPriority.HIGH,
      dedupeKey: this.buildCardDedupeKey({
        fixtureId: params.fixtureId,
        teamId: params.teamId,
        playerId: null,
        elapsed: params.elapsed,
        extra: params.extra,
        detail: params.detail,
      }),
      data: {
        type: eventType,
        fixtureId: params.fixtureId,
        teamId: params.teamId,
        leagueId: params.leagueId,
        cardDetail: params.detail,
        elapsed: params.elapsed,
        extra: params.extra,
      },
    });

    const targets = params.isYellowCard
      ? [
          {
            entityType: FollowEntityType.TEAM,
            entityId: params.teamId,
          },
        ]
      : [
          {
            entityType: FollowEntityType.FIXTURE,
            entityId: params.fixtureId,
          },
          {
            entityType: FollowEntityType.TEAM,
            entityId: params.teamId,
          },
          {
            entityType: FollowEntityType.LEAGUE,
            entityId: params.leagueId,
          },
        ];

    await this.fanoutService.sendToFollowers({
      targets,
      notificationEvent,
      title,
      body,
      deepLink,
      data: {
        type: eventType,
        fixtureId: params.fixtureId,
        teamId: params.teamId,
        leagueId: params.leagueId,
        cardDetail: params.detail,
      },
    });
  }

  private formatEventMinute(
    elapsed: number | null,
    extra: number | null,
  ): string | null {
    if (elapsed === null) {
      return null;
    }

    if (extra !== null && extra > 0) {
      return `${elapsed}+${extra}'`;
    }

    return `${elapsed}'`;
  }

  private async processFixture(fixture: ApiFootballFixture): Promise<void> {
    const fixtureId = String(fixture.fixture.id);
    const leagueId = String(fixture.league.id);
    const homeTeamId = String(fixture.teams.home.id);
    const awayTeamId = String(fixture.teams.away.id);
    const homeGoals = fixture.goals.home ?? 0;
    const awayGoals = fixture.goals.away ?? 0;
    const statusShort = fixture.fixture.status.short;
    const elapsed = fixture.fixture.status.elapsed;

    const snapshot = await this.snapshotRepository.findOne({
      where: {
        fixtureId,
      },
    });

    if (!snapshot) {
      await this.snapshotRepository.save(
        this.snapshotRepository.create({
          fixtureId,
          leagueId,
          homeTeamId,
          awayTeamId,
          homeGoals,
          awayGoals,
          statusShort,
          elapsed,
          lastCheckedAt: new Date(),
        }),
      );

      if (statusShort === '1H' && elapsed !== null && elapsed <= 2) {
        await this.sendStatusNotification({
          fixture,
          fixtureId,
          leagueId,
          statusShort,
          title: 'Kickoff',
          body: `${fixture.teams.home.name} vs ${fixture.teams.away.name} has started`,
          type: NotificationType.MATCH_STARTED,
        });
      }

      return;
    }

    if (homeGoals > snapshot.homeGoals) {
      try {
        await this.sendGoalNotification({
          fixture,
          scoringTeamId: homeTeamId,
          scoringTeamName: fixture.teams.home.name,
          fixtureId,
          leagueId,
          homeGoals,
          awayGoals,
        });
      } catch (error) {
        this.logger.error(
          'Failed to send home goal notification',
          error as Error,
        );
      }
    }

    if (awayGoals > snapshot.awayGoals) {
      try {
        await this.sendGoalNotification({
          fixture,
          scoringTeamId: awayTeamId,
          scoringTeamName: fixture.teams.away.name,
          fixtureId,
          leagueId,
          homeGoals,
          awayGoals,
        });
      } catch (error) {
        this.logger.error(
          'Failed to send away goal notification',
          error as Error,
        );
      }
    }

    if (snapshot.statusShort !== statusShort) {
      await this.handleStatusChange({
        fixture,
        fixtureId,
        leagueId,
        previousStatus: snapshot.statusShort,
        currentStatus: statusShort,
      });
    }

    await this.processCardEvents({
      fixture,
      fixtureId,
      leagueId,
    });

    snapshot.homeGoals = homeGoals;
    snapshot.awayGoals = awayGoals;
    snapshot.statusShort = statusShort;
    snapshot.elapsed = elapsed;
    snapshot.lastCheckedAt = new Date();

    await this.snapshotRepository.save(snapshot);
  }

  private async handleStatusChange(params: {
    fixture: ApiFootballFixture;
    fixtureId: string;
    leagueId: string;
    previousStatus: string | null;
    currentStatus: string;
  }): Promise<void> {
    if (params.currentStatus === 'HT') {
      await this.sendStatusNotification({
        fixture: params.fixture,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
        statusShort: params.currentStatus,
        title: 'Half-time',
        body: `${params.fixture.teams.home.name} vs ${params.fixture.teams.away.name} is at half-time`,
        type: NotificationType.HALF_TIME,
      });
    }

    if (['FT', 'AET', 'PEN'].includes(params.currentStatus)) {
      const homeGoals = params.fixture.goals.home ?? 0;
      const awayGoals = params.fixture.goals.away ?? 0;

      await this.sendStatusNotification({
        fixture: params.fixture,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
        statusShort: params.currentStatus,
        title: 'Full-time',
        body: `${params.fixture.teams.home.name} ${homeGoals}-${awayGoals} ${params.fixture.teams.away.name}`,
        type: NotificationType.FULL_TIME,
      });
    }
  }

  private async sendGoalNotification(params: {
    fixture: ApiFootballFixture;
    scoringTeamId: string;
    scoringTeamName: string;
    fixtureId: string;
    leagueId: string;
    homeGoals: number;
    awayGoals: number;
  }): Promise<void> {
    const homeTeamName = params.fixture.teams.home.name;
    const awayTeamName = params.fixture.teams.away.name;

    const title = `Goal! ${params.scoringTeamName}`;
    const body = `${homeTeamName} ${params.homeGoals}-${params.awayGoals} ${awayTeamName}`;
    const deepLink = `/matches/${params.fixtureId}?tab=facts`;

    const event = await this.notificationsService.createEvent({
      eventType: NotificationType.GOAL,
      entityType: FollowEntityType.TEAM,
      entityId: params.scoringTeamId,
      fixtureId: params.fixtureId,
      teamId: params.scoringTeamId,
      leagueId: params.leagueId,
      title,
      body,
      deepLink,
      priority: NotificationPriority.HIGH,
      dedupeKey: `goal:${params.fixtureId}:${params.scoringTeamId}:${params.homeGoals}-${params.awayGoals}`,
      data: {
        type: 'GOAL',
        fixtureId: params.fixtureId,
        teamId: params.scoringTeamId,
        leagueId: params.leagueId,
        homeGoals: params.homeGoals,
        awayGoals: params.awayGoals,
      },
    });

    await this.fanoutService.sendToFollowers({
      targets: [
        {
          entityType: FollowEntityType.TEAM,
          entityId: params.scoringTeamId,
        },
        {
          entityType: FollowEntityType.FIXTURE,
          entityId: params.fixtureId,
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
        type: 'GOAL',
        fixtureId: params.fixtureId,
        teamId: params.scoringTeamId,
        leagueId: params.leagueId,
      },
    });
  }

  private async sendStatusNotification(params: {
    fixture: ApiFootballFixture;
    fixtureId: string;
    leagueId: string;
    statusShort: string;
    title: string;
    body: string;
    type: NotificationType;
  }): Promise<void> {
    const deepLink = `/matches/${params.fixtureId}`;

    const event = await this.notificationsService.createEvent({
      eventType: params.type,
      entityType: FollowEntityType.FIXTURE,
      entityId: params.fixtureId,
      fixtureId: params.fixtureId,
      leagueId: params.leagueId,
      title: params.title,
      body: params.body,
      deepLink,
      priority: NotificationPriority.HIGH,
      dedupeKey: `status:${params.fixtureId}:${params.statusShort}`,
      data: {
        type: params.type,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
        statusShort: params.statusShort,
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
      title: params.title,
      body: params.body,
      deepLink,
      data: {
        type: params.type,
        fixtureId: params.fixtureId,
        leagueId: params.leagueId,
        statusShort: params.statusShort,
      },
    });
  }
}

// import {
//   Injectable,
//   Logger,
//   OnModuleDestroy,
//   OnModuleInit,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';

// import { FootballService } from 'src/api-football/football.service';
// import { RedisService } from 'src/redis/redis.service';
// import { NotificationType } from 'src/notifications/enums/notification-type.enum';
// import { NotificationPriority } from 'src/notifications/enums/notification-priority.enum';
// import { NotificationsService } from 'src/notifications/notifications.service';
// import { FootballNotificationFanoutService } from '../football-notification-fanout.service';
// import { FootballFixtureNotificationSnapshot } from '../entities/football-fixture-notification-snapshot.entity';
// import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

// interface ApiFootballLiveFixturesResponse {
//   response?: ApiFootballFixture[];
// }

// interface ApiFootballFixture {
//   fixture: {
//     id: number;
//     status: {
//       short: string;
//       elapsed: number | null;
//     };
//   };
//   league: {
//     id: number;
//     name: string;
//   };
//   teams: {
//     home: {
//       id: number;
//       name: string;
//     };
//     away: {
//       id: number;
//       name: string;
//     };
//   };
//   goals: {
//     home: number | null;
//     away: number | null;
//   };
// }

// @Injectable()
// export class GoalNotificationWorker implements OnModuleInit, OnModuleDestroy {
//   private readonly logger = new Logger(GoalNotificationWorker.name);
//   private timer: NodeJS.Timeout | null = null;
//   private isRunning = false;

//   constructor(
//     private readonly footballService: FootballService,
//     private readonly redisService: RedisService,
//     private readonly notificationsService: NotificationsService,
//     private readonly fanoutService: FootballNotificationFanoutService,

//     @InjectRepository(FootballFixtureNotificationSnapshot)
//     private readonly snapshotRepository: Repository<FootballFixtureNotificationSnapshot>,
//   ) {}

//   onModuleInit(): void {
//     const enabled = process.env.GOAL_NOTIFICATION_WORKER_ENABLED === 'true';

//     if (!enabled) {
//       this.logger.log('Goal notification worker disabled');
//       return;
//     }

//     const intervalMs = Number(
//       process.env.GOAL_NOTIFICATION_WORKER_INTERVAL_MS ?? 30000,
//     );

//     this.timer = setInterval(() => {
//       void this.run();
//     }, intervalMs);

//     this.logger.log(`Goal notification worker started: ${intervalMs}ms`);
//   }

//   onModuleDestroy(): void {
//     if (this.timer) {
//       clearInterval(this.timer);
//     }
//   }

//   async run(): Promise<void> {
//     if (this.isRunning) {
//       return;
//     }

//     const hasLock = await this.redisService.setLock(
//       'lock:football-notifications:goal-worker',
//       25,
//     );

//     if (!hasLock) {
//       return;
//     }

//     this.isRunning = true;

//     try {
//       const data =
//         (await this.footballService.getLiveFixtures()) as ApiFootballLiveFixturesResponse;

//       const fixtures = data.response ?? [];

//       for (const fixture of fixtures) {
//         await this.processFixture(fixture);
//       }
//     } catch (error) {
//       this.logger.error('Goal worker failed', error as Error);
//     } finally {
//       this.isRunning = false;
//       await this.redisService.del('lock:football-notifications:goal-worker');
//     }
//   }

//   private async processFixture(fixture: ApiFootballFixture): Promise<void> {
//     const fixtureId = String(fixture.fixture.id);
//     const leagueId = String(fixture.league.id);
//     const homeTeamId = String(fixture.teams.home.id);
//     const awayTeamId = String(fixture.teams.away.id);
//     const homeGoals = fixture.goals.home ?? 0;
//     const awayGoals = fixture.goals.away ?? 0;
//     const statusShort = fixture.fixture.status.short;
//     const elapsed = fixture.fixture.status.elapsed;

//     const snapshot = await this.snapshotRepository.findOne({
//       where: {
//         fixtureId,
//       },
//     });

//     if (!snapshot) {
//       await this.snapshotRepository.save(
//         this.snapshotRepository.create({
//           fixtureId,
//           leagueId,
//           homeTeamId,
//           awayTeamId,
//           homeGoals,
//           awayGoals,
//           statusShort,
//           elapsed,
//           lastCheckedAt: new Date(),
//         }),
//       );

//       return;
//     }

//     if (homeGoals > snapshot.homeGoals) {
//       await this.sendGoalNotification({
//         fixture,
//         scoringTeamId: homeTeamId,
//         scoringTeamName: fixture.teams.home.name,
//         fixtureId,
//         leagueId,
//         homeGoals,
//         awayGoals,
//       });
//     }

//     if (awayGoals > snapshot.awayGoals) {
//       await this.sendGoalNotification({
//         fixture,
//         scoringTeamId: awayTeamId,
//         scoringTeamName: fixture.teams.away.name,
//         fixtureId,
//         leagueId,
//         homeGoals,
//         awayGoals,
//       });
//     }

//     snapshot.homeGoals = homeGoals;
//     snapshot.awayGoals = awayGoals;
//     snapshot.statusShort = statusShort;
//     snapshot.elapsed = elapsed;
//     snapshot.lastCheckedAt = new Date();

//     await this.snapshotRepository.save(snapshot);
//   }

//   private async sendGoalNotification(params: {
//     fixture: ApiFootballFixture;
//     scoringTeamId: string;
//     scoringTeamName: string;
//     fixtureId: string;
//     leagueId: string;
//     homeGoals: number;
//     awayGoals: number;
//   }): Promise<void> {
//     const homeTeamName = params.fixture.teams.home.name;
//     const awayTeamName = params.fixture.teams.away.name;

//     const title = `Goal! ${params.scoringTeamName}`;
//     const body = `${homeTeamName} ${params.homeGoals}-${params.awayGoals} ${awayTeamName}`;
//     const deepLink = `/matches/${params.fixtureId}?tab=facts`;

//     const event = await this.notificationsService.createEvent({
//       eventType: NotificationType.GOAL,
//       entityType: FollowEntityType.TEAM,
//       entityId: params.scoringTeamId,
//       fixtureId: params.fixtureId,
//       teamId: params.scoringTeamId,
//       leagueId: params.leagueId,
//       title,
//       body,
//       deepLink,
//       priority: NotificationPriority.HIGH,
//       dedupeKey: `goal:${params.fixtureId}:${params.scoringTeamId}:${params.homeGoals}-${params.awayGoals}`,
//       data: {
//         type: 'GOAL',
//         fixtureId: params.fixtureId,
//         teamId: params.scoringTeamId,
//         leagueId: params.leagueId,
//         homeGoals: params.homeGoals,
//         awayGoals: params.awayGoals,
//       },
//     });

//     const result = await this.fanoutService.sendToFollowers({
//       targets: [
//         {
//           entityType: FollowEntityType.TEAM,
//           entityId: params.scoringTeamId,
//         },
//         {
//           entityType: FollowEntityType.FIXTURE,
//           entityId: params.fixtureId,
//         },
//       ],
//       notificationEvent: event,
//       title,
//       body,
//       deepLink,
//       data: {
//         type: 'GOAL',
//         fixtureId: params.fixtureId,
//         teamId: params.scoringTeamId,
//         leagueId: params.leagueId,
//       },
//     });

//     this.logger.log(
//       `Goal notification processed: fixture=${params.fixtureId}, team=${params.scoringTeamId}, recipients=${result.recipientCount}`,
//     );
//   }
// }

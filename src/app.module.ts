import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseConfigModule } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { AwsModule } from './modules/aws/aws.module';
import { FilesModule } from './modules/files/files.module';
import { RedisModule } from './redis/redis.module';
import { ApiFootballModule } from './api-football/api-football.module';
import { FirebaseModule } from './firebase/firebase.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FollowsModule } from './modules/follows/follows.module';
import { TheNewsModule } from './the-news/the-news.module';
import { FootballNotificationsModule } from './modules/football-notifications/football-notifications.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseConfigModule,
    AwsModule,
    AuthModule,
    AdminModule,
    UsersModule,
    FilesModule,
    RedisModule,
    ApiFootballModule,
    FirebaseModule,
    NotificationsModule,
    FollowsModule,
    TheNewsModule,
    FootballNotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

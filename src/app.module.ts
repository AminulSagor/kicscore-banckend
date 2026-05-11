import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { DatabaseConfigModule } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { AwsModule } from './modules/aws/aws.module';
import { FilesModule } from './modules/files/files.module';
import { RedisModule } from './redis/redis.module';
import { ApiFootballModule } from './api-football/api-football.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseConfigModule,
    AwsModule,
    AuthModule,
    UsersModule,
    FilesModule,
    RedisModule,
    ApiFootballModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

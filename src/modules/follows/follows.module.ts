import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Follow } from './entities/follow.entity';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { DeviceToken } from 'src/notifications/entities/device-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, Follow])],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}

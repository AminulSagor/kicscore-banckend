import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Follow } from './entities/follow.entity';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { DeviceToken } from 'src/notifications/entities/device-token.entity';
import { FollowEntitySnapshot } from './entities/follow-entity-snapshot.entity';
import { FollowMetadataItem } from './entities/follow-metadata-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceToken,
      Follow,
      FollowEntitySnapshot,
      FollowMetadataItem,
    ]),
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}

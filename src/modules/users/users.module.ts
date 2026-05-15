import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FileEntity } from '../files/entities/file.entity';
import { UserProfile } from './entities/user-profile.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AwsModule } from '../aws/aws.module';
import { UserSetting } from './entities/user-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, FileEntity, UserSetting]),
    AwsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}

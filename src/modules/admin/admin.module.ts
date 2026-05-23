import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Follow } from '../follows/entities/follow.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { User } from '../users/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TheNewsModule } from 'src/the-news/the-news.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, Follow]),
    TheNewsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

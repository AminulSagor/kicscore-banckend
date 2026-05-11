import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FcmService } from './fcm.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { DeviceTokensController } from './device-tokens.controller';
import { DeviceTokensService } from './device-tokens.service';

@Module({
  imports: [FirebaseModule, TypeOrmModule.forFeature([DeviceToken])],
  controllers: [DeviceTokensController],
  providers: [FcmService, DeviceTokensService],
  exports: [FcmService, DeviceTokensService],
})
export class NotificationsModule {}

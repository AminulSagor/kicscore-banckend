import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FcmService } from './fcm.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { DeviceTokensController } from './device-tokens.controller';
import { DeviceTokensService } from './device-tokens.service';
import { NotificationPreference } from './entities/notification-preference.entity';
import { EntityNotificationSetting } from './entities/entity-notification-setting.entity';
import { NotificationEvent } from './entities/notification-event.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';
import { NotificationEventPayloadItem } from './entities/notification-event-payload-item.entity';
import { NotificationDeliveryResponseItem } from './entities/notification-delivery-response-item.entity';
import { UserNotificationContentSnapshot } from './entities/user-notification-content-snapshot.entity';
import { UserNotificationPayloadItem } from './entities/user-notification-payload-item.entity';

@Module({
  imports: [
    FirebaseModule,
    TypeOrmModule.forFeature([
      DeviceToken,
      NotificationPreference,
      EntityNotificationSetting,
      NotificationEvent,
      NotificationEventPayloadItem,
      UserNotification,
      UserNotificationContentSnapshot,
      UserNotificationPayloadItem,
      NotificationDelivery,
      NotificationDeliveryResponseItem,
    ]),
  ],
  controllers: [
    DeviceTokensController,
    NotificationPreferencesController,
    NotificationsController,
  ],
  providers: [
    FcmService,
    DeviceTokensService,
    NotificationPreferencesService,
    NotificationsService,
  ],
  exports: [
    FcmService,
    DeviceTokensService,
    NotificationPreferencesService,
    NotificationsService,
  ],
})
export class NotificationsModule {}

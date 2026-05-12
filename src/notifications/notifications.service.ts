import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationEvent } from './entities/notification-event.entity';
import { NotificationEventPayloadItem } from './entities/notification-event-payload-item.entity';
import { UserNotification } from './entities/user-notification.entity';
import { UserNotificationContentSnapshot } from './entities/user-notification-content-snapshot.entity';
import { UserNotificationPayloadItem } from './entities/user-notification-payload-item.entity';
import { NotificationPriority } from './enums/notification-priority.enum';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationDeliveryResponseItem } from './entities/notification-delivery-response-item.entity';
import { DeviceTokensService } from './device-tokens.service';
import { FcmService } from './fcm.service';
import { NotificationDeliveryStatus } from './enums/notification-delivery-status.enum';
import { FirebaseError } from 'firebase-admin';
import { TestSendNotificationDto } from './dto/test-send-notification.dto';
import { DeviceToken } from './entities/device-token.entity';

type NotificationOwner =
  | {
      userId: string;
      installationId: null;
    }
  | {
      userId: null;
      installationId: string;
    };

interface CreateNotificationEventInput {
  eventType: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  entityType?: FollowEntityType | null;
  entityId?: string | null;
  fixtureId?: string | null;
  teamId?: string | null;
  playerId?: string | null;
  leagueId?: string | null;
  imageUrl?: string | null;
  deepLink?: string | null;
  priority?: NotificationPriority;
  data?: Record<string, unknown> | null;
}

interface CreateNotificationForOwnerInput {
  owner: NotificationOwner;
  notificationEvent: NotificationEvent;
  title?: string;
  body?: string;
  imageUrl?: string | null;
  deepLink?: string | null;
  data?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEvent)
    private readonly notificationEventRepository: Repository<NotificationEvent>,

    @InjectRepository(NotificationEventPayloadItem)
    private readonly notificationEventPayloadRepository: Repository<NotificationEventPayloadItem>,

    @InjectRepository(UserNotification)
    private readonly userNotificationRepository: Repository<UserNotification>,

    @InjectRepository(UserNotificationContentSnapshot)
    private readonly userNotificationContentRepository: Repository<UserNotificationContentSnapshot>,

    @InjectRepository(UserNotificationPayloadItem)
    private readonly userNotificationPayloadRepository: Repository<UserNotificationPayloadItem>,

    @InjectRepository(NotificationDelivery)
    private readonly notificationDeliveryRepository: Repository<NotificationDelivery>,

    @InjectRepository(NotificationDeliveryResponseItem)
    private readonly notificationDeliveryResponseRepository: Repository<NotificationDeliveryResponseItem>,

    private readonly deviceTokensService: DeviceTokensService,
    private readonly fcmService: FcmService,
  ) {}

  async getNotifications(
    query: GetNotificationsQueryDto,
    user: JwtPayload | null,
  ): Promise<{
    items: UserNotification[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const owner = this.resolveOwner(user, query.installationId);
    const page = this.toPositiveNumber(query.page, 1);
    const limit = Math.min(this.toPositiveNumber(query.limit, 20), 50);

    const where: FindOptionsWhere<UserNotification> = {
      ...this.getOwnerWhere(owner),
    };

    if (query.isRead) {
      where.isRead = query.isRead === 'true';
    }

    const [items, total] = await this.userNotificationRepository.findAndCount({
      where,
      relations: {
        notificationEvent: true,
        contentSnapshot: true,
        payloadItems: true,
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(
    notificationId: string,
    query: { installationId?: string },
    user: JwtPayload | null,
  ): Promise<UserNotification> {
    const owner = this.resolveOwner(user, query.installationId);

    const notification = await this.userNotificationRepository.findOne({
      where: {
        id: notificationId,
        ...this.getOwnerWhere(owner),
      },
      relations: {
        notificationEvent: true,
        contentSnapshot: true,
        payloadItems: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    notification.readAt = new Date();

    return this.userNotificationRepository.save(notification);
  }

  async markAllAsRead(
    query: { installationId?: string },
    user: JwtPayload | null,
  ): Promise<{
    updatedCount: number;
  }> {
    const owner = this.resolveOwner(user, query.installationId);

    const result = await this.userNotificationRepository.update(
      {
        ...this.getOwnerWhere(owner),
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return {
      updatedCount: result.affected ?? 0,
    };
  }

  async createEvent(
    input: CreateNotificationEventInput,
  ): Promise<NotificationEvent> {
    const existingEvent = await this.notificationEventRepository.findOne({
      where: {
        dedupeKey: input.dedupeKey,
      },
    });

    if (existingEvent) {
      return existingEvent;
    }

    const event = this.notificationEventRepository.create({
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      fixtureId: input.fixtureId ?? null,
      teamId: input.teamId ?? null,
      playerId: input.playerId ?? null,
      leagueId: input.leagueId ?? null,
      imageUrl: input.imageUrl ?? null,
      deepLink: input.deepLink ?? null,
      priority: input.priority ?? NotificationPriority.MEDIUM,
    });

    const savedEvent = await this.notificationEventRepository.save(event);

    await this.syncEventPayloadItems(savedEvent.id, input.data);

    return savedEvent;
  }

  async createNotificationForOwner(
    input: CreateNotificationForOwnerInput,
  ): Promise<UserNotification> {
    const notification = this.userNotificationRepository.create({
      userId: input.owner.userId,
      installationId: input.owner.installationId,
      notificationEventId: input.notificationEvent.id,
      isRead: false,
      readAt: null,
    });

    const savedNotification =
      await this.userNotificationRepository.save(notification);

    await this.saveNotificationContentSnapshot({
      notificationId: savedNotification.id,
      title: input.title ?? input.notificationEvent.title,
      body: input.body ?? input.notificationEvent.body,
      imageUrl: input.imageUrl ?? input.notificationEvent.imageUrl,
      deepLink: input.deepLink ?? input.notificationEvent.deepLink,
    });

    await this.syncNotificationPayloadItems(savedNotification.id, input.data);

    return savedNotification;
  }

  private async saveNotificationContentSnapshot(params: {
    notificationId: string;
    title: string;
    body: string;
    imageUrl: string | null;
    deepLink: string | null;
  }): Promise<void> {
    const snapshot = this.userNotificationContentRepository.create({
      notificationId: params.notificationId,
      title: params.title,
      body: params.body,
      imageUrl: params.imageUrl,
      deepLink: params.deepLink,
    });

    await this.userNotificationContentRepository.save(snapshot);
  }

  private async syncEventPayloadItems(
    notificationEventId: string,
    data?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!data) {
      return;
    }

    const items = Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) =>
        this.notificationEventPayloadRepository.create({
          notificationEventId,
          key,
          value: String(value),
        }),
      );

    if (items.length) {
      await this.notificationEventPayloadRepository.save(items);
    }
  }

  private async syncNotificationPayloadItems(
    notificationId: string,
    data?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!data) {
      return;
    }

    const items = Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) =>
        this.userNotificationPayloadRepository.create({
          notificationId,
          key,
          value: String(value),
        }),
      );

    if (items.length) {
      await this.userNotificationPayloadRepository.save(items);
    }
  }

  private resolveOwner(
    user: JwtPayload | null,
    installationId?: string,
  ): NotificationOwner {
    if (user?.sub) {
      return {
        userId: user.sub,
        installationId: null,
      };
    }

    if (!installationId) {
      throw new BadRequestException(
        'installationId is required for anonymous users',
      );
    }

    return {
      userId: null,
      installationId,
    };
  }

  private getOwnerWhere(
    owner: NotificationOwner,
  ): FindOptionsWhere<UserNotification> {
    if (owner.userId) {
      return {
        userId: owner.userId,
      };
    }

    return {
      userId: IsNull(),
      installationId: owner.installationId ?? IsNull(),
    };
  }

  private toPositiveNumber(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsedValue = Number(value);

    if (!value || Number.isNaN(parsedValue) || parsedValue < 1) {
      return fallback;
    }

    return parsedValue;
  }

  async sendEventToOwner(input: {
    userId: string | null;
    installationId: string | null;
    notificationEvent: NotificationEvent;
    title?: string;
    body?: string;
    imageUrl?: string | null;
    deepLink?: string | null;
    data?: Record<string, unknown> | null;
  }): Promise<{
    notification: UserNotification;
    totalTokens: number;
    sentCount: number;
    failedCount: number;
  }> {
    const owner = this.resolveOwnerFromIds(input.userId, input.installationId);

    const notification = await this.createNotificationForOwner({
      owner,
      notificationEvent: input.notificationEvent,
      title: input.title ?? input.notificationEvent.title,
      body: input.body ?? input.notificationEvent.body,
      imageUrl: input.imageUrl ?? input.notificationEvent.imageUrl,
      deepLink: input.deepLink ?? input.notificationEvent.deepLink,
      data: input.data ?? null,
    });

    let deviceTokens: DeviceToken[] = [];

    if (owner.userId) {
      deviceTokens = await this.deviceTokensService.findActiveTokensByUserId(
        owner.userId,
      );
    } else {
      const installationId = owner.installationId;

      if (!installationId) {
        throw new BadRequestException(
          'installationId is required for anonymous users',
        );
      }

      deviceTokens =
        await this.deviceTokensService.findActiveTokensByInstallationId(
          installationId,
        );
    }

    if (!deviceTokens.length) {
      throw new BadRequestException('No active device token found');
    }

    // const deviceTokens = owner.userId
    //   ? await this.deviceTokensService.findActiveTokensByUserId(owner.userId)
    //   : await this.deviceTokensService.findActiveTokensByInstallationId(
    //       owner.installationId,
    //     );

    let sentCount = 0;
    let failedCount = 0;

    for (const deviceToken of deviceTokens) {
      const delivery = await this.notificationDeliveryRepository.save(
        this.notificationDeliveryRepository.create({
          notificationId: notification.id,
          deviceTokenId: deviceToken.id,
          status: NotificationDeliveryStatus.PENDING,
        }),
      );

      try {
        const providerMessageId = await this.fcmService.sendToToken({
          token: deviceToken.token,
          title: input.title ?? input.notificationEvent.title,
          body: input.body ?? input.notificationEvent.body,
          imageUrl: input.imageUrl ?? input.notificationEvent.imageUrl,
          data: this.toStringData(input.data),
        });

        delivery.status = NotificationDeliveryStatus.SENT;
        delivery.providerMessageId = providerMessageId;
        delivery.sentAt = new Date();

        await this.notificationDeliveryRepository.save(delivery);
        sentCount += 1;
      } catch (error) {
        const firebaseError = error as FirebaseError;

        delivery.status = NotificationDeliveryStatus.FAILED;
        delivery.errorCode = firebaseError.code ?? 'unknown_error';
        delivery.errorMessage =
          firebaseError.message ?? 'Failed to send notification';
        delivery.failedAt = new Date();

        await this.notificationDeliveryRepository.save(delivery);

        await this.saveDeliveryResponseItems(delivery.id, {
          code: delivery.errorCode,
          message: delivery.errorMessage,
        });

        if (this.isInvalidFcmTokenError(delivery.errorCode)) {
          await this.deviceTokensService.deactivateById(deviceToken.id);
        }

        failedCount += 1;
      }
    }

    return {
      notification,
      totalTokens: deviceTokens.length,
      sentCount,
      failedCount,
    };
  }

  private resolveOwnerFromIds(
    userId: string | null,
    installationId: string | null,
  ): NotificationOwner {
    if (userId) {
      return {
        userId,
        installationId: null,
      };
    }

    if (installationId) {
      return {
        userId: null,
        installationId,
      };
    }

    throw new BadRequestException('Notification owner is required');
  }

  // for test only
  async testSend(
    dto: TestSendNotificationDto,
    user: JwtPayload | null,
  ): Promise<{
    notification: UserNotification;
    totalTokens: number;
    sentCount: number;
    failedCount: number;
  }> {
    const owner = this.resolveOwner(user, dto.installationId);

    let deviceTokens: DeviceToken[] = [];

    if (owner.userId) {
      deviceTokens = await this.deviceTokensService.findActiveTokensByUserId(
        owner.userId,
      );
    } else {
      const installationId = owner.installationId;

      if (!installationId) {
        throw new BadRequestException(
          'installationId is required for anonymous users',
        );
      }

      deviceTokens =
        await this.deviceTokensService.findActiveTokensByInstallationId(
          installationId,
        );
    }

    if (!deviceTokens.length) {
      throw new BadRequestException('No active device token found');
    }

    const event = await this.createEvent({
      eventType: NotificationType.SYSTEM,
      title: dto.title,
      body: dto.body,
      dedupeKey: `test:${owner.userId ?? owner.installationId}:${Date.now()}`,
      imageUrl: dto.imageUrl ?? null,
      deepLink: dto.deepLink ?? null,
      priority: NotificationPriority.HIGH,
      data: dto.data ?? null,
    });

    const notification = await this.createNotificationForOwner({
      owner,
      notificationEvent: event,
      title: dto.title,
      body: dto.body,
      imageUrl: dto.imageUrl ?? null,
      deepLink: dto.deepLink ?? null,
      data: dto.data ?? null,
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const deviceToken of deviceTokens) {
      const delivery = await this.notificationDeliveryRepository.save(
        this.notificationDeliveryRepository.create({
          notificationId: notification.id,
          deviceTokenId: deviceToken.id,
          status: NotificationDeliveryStatus.PENDING,
        }),
      );

      try {
        const providerMessageId = await this.fcmService.sendToToken({
          token: deviceToken.token,
          title: dto.title,
          body: dto.body,
          imageUrl: dto.imageUrl ?? null,
          data: this.toStringData(dto.data),
        });

        delivery.status = NotificationDeliveryStatus.SENT;
        delivery.providerMessageId = providerMessageId;
        delivery.sentAt = new Date();

        await this.notificationDeliveryRepository.save(delivery);
        sentCount += 1;
      } catch (error) {
        const firebaseError = error as FirebaseError;

        delivery.status = NotificationDeliveryStatus.FAILED;
        delivery.errorCode = firebaseError.code ?? 'unknown_error';
        delivery.errorMessage =
          firebaseError.message ?? 'Failed to send notification';
        delivery.failedAt = new Date();

        await this.notificationDeliveryRepository.save(delivery);

        await this.saveDeliveryResponseItems(delivery.id, {
          code: delivery.errorCode,
          message: delivery.errorMessage,
        });

        if (this.isInvalidFcmTokenError(delivery.errorCode)) {
          await this.deviceTokensService.deactivateById(deviceToken.id);
        }

        failedCount += 1;
      }
    }

    return {
      notification,
      totalTokens: deviceTokens.length,
      sentCount,
      failedCount,
    };
  }

  private toStringData(
    data?: Record<string, unknown> | null,
  ): Record<string, string> | undefined {
    if (!data) {
      return undefined;
    }

    return Object.entries(data).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (value !== undefined && value !== null) {
          result[key] = String(value);
        }

        return result;
      },
      {},
    );
  }

  private isInvalidFcmTokenError(errorCode: string | null): boolean {
    if (!errorCode) {
      return false;
    }

    return [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ].includes(errorCode);
  }

  private async saveDeliveryResponseItems(
    deliveryId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const items = Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) =>
        this.notificationDeliveryResponseRepository.create({
          deliveryId,
          key,
          value: String(value),
        }),
      );

    if (items.length) {
      await this.notificationDeliveryResponseRepository.save(items);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';

import { NotificationEvent } from './entities/notification-event.entity';
import { UserNotification } from './entities/user-notification.entity';

const CLEANUP_BATCH_SIZE = 500;

export interface NotificationRetentionResult {
  deletedNotifications: number;
  deletedOrphanEvents: number;
}

interface IdRow {
  id: string;
}

@Injectable()
export class NotificationRetentionService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly userNotificationRepository: Repository<UserNotification>,

    @InjectRepository(NotificationEvent)
    private readonly notificationEventRepository: Repository<NotificationEvent>,
  ) {}

  async deleteNotificationHistoryBefore(
    cutoffDate: Date,
  ): Promise<NotificationRetentionResult> {
    const deletedNotifications =
      await this.deleteUserNotificationsBefore(cutoffDate);

    const deletedOrphanEvents =
      await this.deleteOrphanNotificationEventsBefore(cutoffDate);

    return {
      deletedNotifications,
      deletedOrphanEvents,
    };
  }

  private async deleteUserNotificationsBefore(
    cutoffDate: Date,
  ): Promise<number> {
    let deletedNotifications = 0;

    while (true) {
      const notifications = await this.userNotificationRepository.find({
        select: {
          id: true,
        },
        where: {
          createdAt: LessThan(cutoffDate),
        },
        order: {
          createdAt: 'ASC',
        },
        take: CLEANUP_BATCH_SIZE,
      });

      const notificationIds = notifications.map(
        (notification) => notification.id,
      );

      if (!notificationIds.length) {
        break;
      }

      const result = await this.userNotificationRepository.delete({
        id: In(notificationIds),
      });

      deletedNotifications += result.affected ?? 0;

      if (notificationIds.length < CLEANUP_BATCH_SIZE) {
        break;
      }
    }

    return deletedNotifications;
  }

  private async deleteOrphanNotificationEventsBefore(
    cutoffDate: Date,
  ): Promise<number> {
    let deletedOrphanEvents = 0;

    while (true) {
      const rows = await this.notificationEventRepository
        .createQueryBuilder('event')
        .select('event.id', 'id')
        .where('event.createdAt < :cutoffDate', { cutoffDate })
        .andWhere((queryBuilder) => {
          const existingNotificationQuery = queryBuilder
            .subQuery()
            .select('1')
            .from(UserNotification, 'notification')
            .where('notification.notificationEventId = event.id')
            .getQuery();

          return `NOT EXISTS ${existingNotificationQuery}`;
        })
        .orderBy('event.createdAt', 'ASC')
        .take(CLEANUP_BATCH_SIZE)
        .getRawMany<IdRow>();

      const eventIds = rows.map((row) => row.id);

      if (!eventIds.length) {
        break;
      }

      const result = await this.notificationEventRepository.delete({
        id: In(eventIds),
      });

      deletedOrphanEvents += result.affected ?? 0;

      if (eventIds.length < CLEANUP_BATCH_SIZE) {
        break;
      }
    }

    return deletedOrphanEvents;
  }
}

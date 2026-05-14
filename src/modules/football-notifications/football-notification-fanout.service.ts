import { Injectable } from '@nestjs/common';

import { FollowEntityType } from '../follows/enums/follow-entity-type.enum';
import { FollowsService } from '../follows/follows.service';
import { NotificationEvent } from 'src/notifications/entities/notification-event.entity';
import { NotificationsService } from 'src/notifications/notifications.service';

interface FanoutTarget {
  entityType: FollowEntityType;
  entityId: string;
}

@Injectable()
export class FootballNotificationFanoutService {
  constructor(
    private readonly followsService: FollowsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendToFollowers(params: {
    targets: FanoutTarget[];
    notificationEvent: NotificationEvent;
    title?: string;
    body?: string;
    imageUrl?: string | null;
    deepLink?: string | null;
    data?: Record<string, unknown> | null;
  }): Promise<{
    targetCount: number;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
  }> {
    const ownerMap = new Map<
      string,
      {
        userId: string | null;
        installationId: string | null;
      }
    >();

    for (const target of params.targets) {
      const followers = await this.followsService.findActiveFollowersByEntity({
        entityType: target.entityType,
        entityId: target.entityId,
      });

      for (const follow of followers) {
        if (follow.userId) {
          ownerMap.set(`user:${follow.userId}`, {
            userId: follow.userId,
            installationId: null,
          });
        }

        if (follow.installationId) {
          ownerMap.set(`installation:${follow.installationId}`, {
            userId: null,
            installationId: follow.installationId,
          });
        }
      }
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const owner of ownerMap.values()) {
      try {
        const result = await this.notificationsService.sendEventToOwner({
          userId: owner.userId,
          installationId: owner.installationId,
          notificationEvent: params.notificationEvent,
          title: params.title,
          body: params.body,
          imageUrl: params.imageUrl,
          deepLink: params.deepLink,
          data: params.data,
        });

        sentCount += result.sentCount;
        failedCount += result.failedCount;
      } catch {
        failedCount += 1;
      }
    }

    return {
      targetCount: params.targets.length,
      recipientCount: ownerMap.size,
      sentCount,
      failedCount,
    };
  }
}

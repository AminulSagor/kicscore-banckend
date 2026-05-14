import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateFollowDto } from './dto/create-follow.dto';
import { FollowStatusQueryDto } from './dto/follow-status-query.dto';
import { GetFollowsQueryDto } from './dto/get-follows-query.dto';
import { FollowEntitySnapshot } from './entities/follow-entity-snapshot.entity';
import { FollowMetadataItem } from './entities/follow-metadata-item.entity';
import { Follow } from './entities/follow.entity';
import { FollowEntityType } from './enums/follow-entity-type.enum';

type FollowOwner =
  | {
      userId: string;
      installationId: null;
    }
  | {
      userId: null;
      installationId: string;
    };

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,

    @InjectRepository(FollowEntitySnapshot)
    private readonly followEntitySnapshotRepository: Repository<FollowEntitySnapshot>,

    @InjectRepository(FollowMetadataItem)
    private readonly followMetadataItemRepository: Repository<FollowMetadataItem>,
  ) {}

  async follow(dto: CreateFollowDto, user: JwtPayload | null): Promise<Follow> {
    const owner = this.resolveOwner(user, dto.installationId);
    const entityId = String(dto.entityId);

    let follow = await this.followRepository.findOne({
      where: {
        ...this.getOwnerWhere(owner),
        entityType: dto.entityType,
        entityId,
      },
      relations: {
        entitySnapshot: true,
        metadataItems: true,
      },
    });

    if (!follow) {
      follow = this.followRepository.create({
        userId: owner.userId,
        installationId: owner.installationId,
        entityType: dto.entityType,
        entityId,
      });
    }

    follow.notificationEnabled = dto.notificationEnabled ?? true;
    follow.isActive = true;

    const savedFollow = await this.followRepository.save(follow);

    await this.upsertEntitySnapshot(savedFollow.id, {
      entityName: dto.entityName,
      entityLogo: dto.entityLogo,
    });

    await this.syncMetadataItems(savedFollow.id, dto.metadata);

    return this.getFollowById(savedFollow.id);
  }

  async unfollow(params: {
    entityType: FollowEntityType;
    entityId: string;
    installationId?: string;
    user: JwtPayload | null;
  }): Promise<void> {
    const owner = this.resolveOwner(params.user, params.installationId);

    const follow = await this.followRepository.findOne({
      where: {
        ...this.getOwnerWhere(owner),
        entityType: params.entityType,
        entityId: String(params.entityId),
        isActive: true,
      },
    });

    if (!follow) {
      return;
    }

    follow.isActive = false;
    follow.notificationEnabled = false;

    await this.followRepository.save(follow);
  }

  async getMyFollows(
    query: GetFollowsQueryDto,
    user: JwtPayload | null,
  ): Promise<Follow[]> {
    const owner = this.resolveOwner(user, query.installationId);

    const where: FindOptionsWhere<Follow> = {
      ...this.getOwnerWhere(owner),
      isActive: true,
    };

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    return this.followRepository.find({
      where,
      relations: {
        entitySnapshot: true,
        metadataItems: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getFollowStatus(
    query: FollowStatusQueryDto,
    user: JwtPayload | null,
  ): Promise<{
    followed: boolean;
    follow: Follow | null;
  }> {
    const owner = this.resolveOwner(user, query.installationId);

    const follow = await this.followRepository.findOne({
      where: {
        ...this.getOwnerWhere(owner),
        entityType: query.entityType,
        entityId: String(query.entityId),
        isActive: true,
      },
      relations: {
        entitySnapshot: true,
        metadataItems: true,
      },
    });

    return {
      followed: Boolean(follow),
      follow,
    };
  }

  async mergeAnonymousFollows(
    installationId: string,
    user: JwtPayload,
  ): Promise<{
    mergedCount: number;
  }> {
    const anonymousFollows = await this.followRepository.find({
      where: {
        userId: IsNull(),
        installationId,
        isActive: true,
      },
      relations: {
        entitySnapshot: true,
        metadataItems: true,
      },
    });

    let mergedCount = 0;

    for (const anonymousFollow of anonymousFollows) {
      const existingUserFollow = await this.followRepository.findOne({
        where: {
          userId: user.sub,
          entityType: anonymousFollow.entityType,
          entityId: anonymousFollow.entityId,
        },
      });

      if (existingUserFollow) {
        existingUserFollow.isActive = true;
        existingUserFollow.notificationEnabled =
          existingUserFollow.notificationEnabled ||
          anonymousFollow.notificationEnabled;

        anonymousFollow.isActive = false;
        anonymousFollow.notificationEnabled = false;

        await this.followRepository.save([existingUserFollow, anonymousFollow]);
        mergedCount += 1;
        continue;
      }

      anonymousFollow.userId = user.sub;
      anonymousFollow.installationId = null;
      anonymousFollow.isActive = true;

      await this.followRepository.save(anonymousFollow);
      mergedCount += 1;
    }

    return {
      mergedCount,
    };
  }

  async findActiveFollowersByEntity(params: {
    entityType: FollowEntityType;
    entityId: string;
  }): Promise<Follow[]> {
    return this.followRepository.find({
      where: {
        entityType: params.entityType,
        entityId: String(params.entityId),
        isActive: true,
        notificationEnabled: true,
      },
      relations: {
        entitySnapshot: true,
        metadataItems: true,
      },
    });
  }

  private async getFollowById(followId: string): Promise<Follow> {
    const follow = await this.followRepository.findOne({
      where: {
        id: followId,
      },
      relations: {
        entitySnapshot: true,
        metadataItems: true,
      },
    });

    if (!follow) {
      throw new BadRequestException('Follow not found after save');
    }

    return follow;
  }

  private async upsertEntitySnapshot(
    followId: string,
    data: {
      entityName?: string;
      entityLogo?: string;
    },
  ): Promise<void> {
    if (data.entityName === undefined && data.entityLogo === undefined) {
      return;
    }

    let snapshot = await this.followEntitySnapshotRepository.findOne({
      where: {
        followId,
      },
    });

    if (!snapshot) {
      snapshot = this.followEntitySnapshotRepository.create({
        followId,
      });
    }

    snapshot.entityName = data.entityName ?? snapshot.entityName ?? null;
    snapshot.entityLogo = data.entityLogo ?? snapshot.entityLogo ?? null;

    await this.followEntitySnapshotRepository.save(snapshot);
  }

  private async syncMetadataItems(
    followId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!metadata) {
      return;
    }

    await this.followMetadataItemRepository.delete({
      followId,
    });

    const items = Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) =>
        this.followMetadataItemRepository.create({
          followId,
          key,
          value: String(value),
        }),
      );

    if (items.length) {
      await this.followMetadataItemRepository.save(items);
    }
  }

  private resolveOwner(
    user: JwtPayload | null,
    installationId?: string,
  ): FollowOwner {
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

  private getOwnerWhere(owner: FollowOwner): FindOptionsWhere<Follow> {
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
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { Follow } from './entities/follow.entity';
import { FollowEntityType } from './enums/follow-entity-type.enum';
import { CreateFollowDto } from './dto/create-follow.dto';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { GetFollowsQueryDto } from './dto/get-follows-query.dto';
import { FollowStatusQueryDto } from './dto/follow-status-query.dto';

interface FollowOwner {
  userId: string | null;
  installationId: string | null;
}

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
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
    });

    if (!follow) {
      follow = this.followRepository.create({
        userId: owner.userId,
        installationId: owner.installationId,
        entityType: dto.entityType,
        entityId,
      });
    }

    follow.entityName = dto.entityName ?? follow.entityName ?? null;
    follow.entityLogo = dto.entityLogo ?? follow.entityLogo ?? null;
    follow.metadata = dto.metadata ?? follow.metadata ?? null;
    follow.notificationEnabled = dto.notificationEnabled ?? true;
    follow.isActive = true;

    return this.followRepository.save(follow);
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
    });
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'stream';
import { Repository } from 'typeorm';

import { Follow } from '../follows/entities/follow.entity';
import { FollowEntityType } from '../follows/enums/follow-entity-type.enum';
import { UserProfile } from '../users/entities/user-profile.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { CreateAdminProfileDto } from './dto/create-admin-profile.dto';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { compareHash, hashValue } from 'src/common/utils/password.util';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,

    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  async getDashboardOverview(): Promise<{
    totalUsers: number;
    activeToday: number;
    pendingVerificationUsers: number;
    suspendedUsers: number;
    totalFollows: number;
    totalFollowedTeams: number;
    totalFollowedLeagues: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeToday,
      pendingVerificationUsers,
      suspendedUsers,
      totalFollows,
      totalFollowedTeams,
      totalFollowedLeagues,
    ] = await Promise.all([
      this.userRepository.count({
        where: {
          status: UserStatus.ACTIVE,
        },
      }),

      this.userRepository
        .createQueryBuilder('user')
        .where('user.last_login_at >= :todayStart', { todayStart })
        .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
        .getCount(),

      this.userRepository.count({
        where: {
          status: UserStatus.PENDING_VERIFICATION,
        },
      }),

      this.userRepository.count({
        where: {
          status: UserStatus.SUSPENDED,
        },
      }),

      this.followRepository.count({
        where: {
          isActive: true,
        },
      }),

      this.followRepository
        .createQueryBuilder('follow')
        .where('follow.is_active = true')
        .andWhere('follow.entity_type = :entityType', {
          entityType: FollowEntityType.TEAM,
        })
        .getCount(),

      this.followRepository
        .createQueryBuilder('follow')
        .where('follow.is_active = true')
        .andWhere('follow.entity_type = :entityType', {
          entityType: FollowEntityType.LEAGUE,
        })
        .getCount(),
    ]);

    return {
      totalUsers,
      activeToday,
      pendingVerificationUsers,
      suspendedUsers,
      totalFollows,
      totalFollowedTeams,
      totalFollowedLeagues,
    };
  }

  async getTopFollowedEntities(params: {
    entityType: FollowEntityType.TEAM | FollowEntityType.LEAGUE;
    page?: string;
    limit?: string;
  }): Promise<{
    items: Array<{
      entityId: string;
      entityName: string | null;
      entityLogo: string | null;
      followersCount: number;
    }>;
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = this.toPositiveNumber(params.page, 1);
    const limit = Math.min(this.toPositiveNumber(params.limit, 10), 50);
    const offset = (page - 1) * limit;

    const totalResult = await this.followRepository
      .createQueryBuilder('follow')
      .where('follow.is_active = true')
      .andWhere('follow.entity_type = :entityType', {
        entityType: params.entityType,
      })
      .select('COUNT(DISTINCT follow.entity_id)', 'total')
      .getRawOne<{ total: string }>();

    const total = Number(totalResult?.total ?? 0);

    const rows = await this.followRepository
      .createQueryBuilder('follow')
      .leftJoin('follow.entitySnapshot', 'snapshot')
      .where('follow.is_active = true')
      .andWhere('follow.entity_type = :entityType', {
        entityType: params.entityType,
      })
      .select('follow.entity_id', 'entityId')
      .addSelect('MAX(snapshot.entity_name)', 'entityName')
      .addSelect('MAX(snapshot.entity_logo)', 'entityLogo')
      .addSelect('COUNT(follow.id)', 'followersCount')
      .groupBy('follow.entity_id')
      .orderBy('"followersCount"', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<{
        entityId: string;
        entityName: string | null;
        entityLogo: string | null;
        followersCount: string;
      }>();

    return {
      items: rows.map((row) => ({
        entityId: row.entityId,
        entityName: row.entityName,
        entityLogo: row.entityLogo,
        followersCount: Number(row.followersCount),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  getTopFollowedLeagues(page?: string, limit?: string) {
    return this.getTopFollowedEntities({
      entityType: FollowEntityType.LEAGUE,
      page,
      limit,
    });
  }

  getTopFollowedTeams(page?: string, limit?: string) {
    return this.getTopFollowedEntities({
      entityType: FollowEntityType.TEAM,
      page,
      limit,
    });
  }

  async getUsers(query: AdminUsersQueryDto): Promise<{
    items: User[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = Math.min(this.toPositiveNumber(query.limit, 10), 50);

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile');

    if (query.status === UserStatus.DELETED) {
      queryBuilder.withDeleted();
      queryBuilder.where('user.status = :status', {
        status: UserStatus.DELETED,
      });
    } else {
      queryBuilder.where('user.deleted_at IS NULL');

      if (query.status) {
        queryBuilder.andWhere('user.status = :status', {
          status: query.status,
        });
      }
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR profile.full_name ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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

  async updateUserStatus(
    adminUserId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ): Promise<User> {
    if (adminUserId === userId) {
      throw new BadRequestException('You cannot change your own status');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin user status cannot be changed here');
    }

    user.status = dto.status;

    return this.userRepository.save(user);
  }

  async deleteUser(adminUserId: string, userId: string): Promise<null> {
    if (adminUserId === userId) {
      throw new BadRequestException('You cannot delete your own account here');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin user cannot be deleted here');
    }

    user.status = UserStatus.DELETED;
    user.email = `deleted-${user.id}@deleted.kicscore.local`;
    user.emailVerifiedAt = null;
    user.lastLoginAt = null;

    await this.userRepository.save(user);
    await this.userRepository.softDelete({ id: userId });

    return null;
  }

  async createAdminUser(
    dto: CreateAdminProfileDto,
    providedSecret?: string,
  ): Promise<{
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    profile: UserProfile;
  }> {
    const enabled = process.env.ADMIN_CREATE_ENABLED === 'true';
    const expectedSecret = process.env.ADMIN_CREATE_SECRET;

    if (!enabled) {
      throw new ForbiddenException('Admin creation is disabled');
    }

    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid admin creation secret');
    }

    const existingUser = await this.userRepository.findOne({
      where: {
        email: dto.email.toLowerCase(),
      },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
    });

    const savedUser = await this.userRepository.save(user);

    const profile = this.userProfileRepository.create({
      userId: savedUser.id,
      fullName: dto.fullName,
      profilePhotoFileId: dto.profilePhotoFileId ?? null,
    });

    const savedProfile = await this.userProfileRepository.save(profile);

    return {
      id: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
      status: savedUser.status,
      profile: savedProfile,
    };
  }

  async getMyAdminProfile(userId: string): Promise<User> {
    return this.getActiveAdminUser(userId);
  }

  async updateMyAdminProfile(
    userId: string,
    dto: UpdateAdminProfileDto,
  ): Promise<UserProfile> {
    await this.getActiveAdminUser(userId);

    let profile = await this.userProfileRepository.findOne({
      where: {
        userId,
      },
    });

    if (!profile) {
      if (!dto.fullName) {
        throw new BadRequestException(
          'fullName is required because profile does not exist',
        );
      }

      profile = this.userProfileRepository.create({
        userId,
        fullName: dto.fullName,
        profilePhotoFileId: dto.profilePhotoFileId ?? null,
      });

      return this.userProfileRepository.save(profile);
    }

    profile.fullName = dto.fullName ?? profile.fullName;
    profile.profilePhotoFileId =
      dto.profilePhotoFileId === undefined
        ? profile.profilePhotoFileId
        : dto.profilePhotoFileId;

    return this.userProfileRepository.save(profile);
  }

  async deleteMyAdminProfile(userId: string): Promise<null> {
    await this.getActiveAdminUser(userId);

    await this.userProfileRepository.delete({
      userId,
    });

    return null;
  }

  async exportDashboardReport(): Promise<StreamableFile> {
    const overview = await this.getDashboardOverview();
    const leagues = await this.getTopFollowedLeagues('1', '10');
    const teams = await this.getTopFollowedTeams('1', '10');

    const rows = [
      ['Metric', 'Value'],
      ['Total Users', overview.totalUsers],
      ['Active Today', overview.activeToday],
      ['Pending Verification Users', overview.pendingVerificationUsers],
      ['Suspended Users', overview.suspendedUsers],
      ['Total Follows', overview.totalFollows],
      ['Total Followed Teams', overview.totalFollowedTeams],
      ['Total Followed Leagues', overview.totalFollowedLeagues],
      [],
      ['Top Leagues', 'Followers'],
      ...leagues.items.map((item) => [
        item.entityName ?? item.entityId,
        item.followersCount,
      ]),
      [],
      ['Top Teams', 'Followers'],
      ...teams.items.map((item) => [
        item.entityName ?? item.entityId,
        item.followersCount,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    return new StreamableFile(Readable.from([csv]), {
      type: 'text/csv',
      disposition: 'attachment; filename="kicscore-admin-report.csv"',
    });
  }

  private async getActiveAdminUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
      relations: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    return user;
  }

  private toPositiveNumber(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number(value);

    if (!value || Number.isNaN(parsed) || parsed < 1) {
      return fallback;
    }

    return parsed;
  }

  async changeMyAdminPassword(
    adminUserId: string,
    dto: ChangePasswordDto,
  ): Promise<null> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :adminUserId', { adminUserId })
      .andWhere('user.role = :role', { role: UserRole.ADMIN })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getOne();

    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    const passwordMatched = await compareHash(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await hashValue(dto.newPassword);

    await this.userRepository.save(user);

    return null;
  }
}

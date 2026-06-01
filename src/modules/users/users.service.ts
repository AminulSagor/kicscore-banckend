import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { FileEntity } from '../files/entities/file.entity';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
  UpdateProfileDto,
  UpdateProfilePhotoDto,
} from './dto/update-profile.dto';
import { UserProfile } from './entities/user-profile.entity';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';
import { FileStatus } from '../files/enums/file-status.enum';
import { S3Service } from '../aws/s3.service';
import { UserSetting } from './entities/user-setting.entity';
import { DeviceToken } from '../../notifications/entities/device-token.entity';
import { OtpCode } from '../auth/entities/otp-code.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { compareHash, hashValue } from 'src/common/utils/password.util';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UnitSystem } from 'src/common/utils/unit-system.enum';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly s3Service: S3Service,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,

    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,

    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,

    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,

    @InjectRepository(UserSetting)
    private readonly userSettingRepository: Repository<UserSetting>,
  ) {}

  async getMe(userId: string): Promise<unknown> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        profile: {
          profilePhotoFile: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let photoReadUrl: string | null = null;

    const profilePhotoFile = user.profile?.profilePhotoFile;

    if (profilePhotoFile && profilePhotoFile.status === FileStatus.UPLOADED) {
      const signedReadUrlResult = await this.s3Service.createSignedReadUrl(
        profilePhotoFile.fileKey,
      );

      photoReadUrl = signedReadUrlResult.signedUrl;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      profile: {
        fullName: user.profile?.fullName ?? null,
        profilePhotoFileId: user.profile?.profilePhotoFileId ?? null,
        photoReadUrl,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<unknown> {
    const profile = await this.userProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    profile.fullName = dto.fullName.trim();
    await this.userProfileRepository.save(profile);

    return {
      fullName: profile.fullName,
    };
  }

  async updateProfilePhoto(
    userId: string,
    dto: UpdateProfilePhotoDto,
  ): Promise<unknown> {
    const file = await this.fileRepository.findOne({
      where: {
        id: dto.fileId,
        ownerUserId: userId,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const profile = await this.userProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (file.status !== FileStatus.UPLOADED) {
      throw new BadRequestException('File upload is not confirmed yet');
    }

    profile.profilePhotoFileId = file.id;
    await this.userProfileRepository.save(profile);

    const signedReadUrlResult = await this.s3Service.createSignedReadUrl(
      file.fileKey,
    );

    return {
      profilePhotoFileId: file.id,
      photoReadUrl: signedReadUrlResult.signedUrl,
    };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        profile: true,
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException('User not found');
    }

    const submittedName = this.normalizeName(dto.fullName);
    const actualName = this.normalizeName(user.profile.fullName);

    if (submittedName !== actualName) {
      throw new BadRequestException('Full name confirmation does not match');
    }

    // Fully remove user and all non-cascading related data.
    await this.dataSource.transaction(async (manager) => {
      // remove files from S3 for uploaded files owned by user
      const files = await manager.find(FileEntity, {
        where: { ownerUserId: userId },
      });

      for (const f of files) {
        if (f.status === FileStatus.UPLOADED) {
          try {
            await this.s3Service.deleteObject(f.fileKey);
          } catch {
            // swallow S3 delete errors to not block account deletion
          }
        }
      }

      // delete file records
      await manager.delete(FileEntity, { ownerUserId: userId });

      // delete device tokens (these are set to SET NULL on FK, we remove them to leave no trace)
      await manager.delete(DeviceToken, { userId });

      // delete otp codes linked to user
      await manager.delete(OtpCode, { userId });

      // delete user settings
      await manager.delete(UserSetting, { userId });

      // deleting the user will cascade-delete profile and most notification-related records
      await manager.delete(User, { id: userId });
    });
  }

  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  async changeMyPassword(
    userId: string,
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
      .where('user.id = :userId', { userId })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
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

  async getMySettings(userId: string): Promise<UserSetting> {
    return this.getOrCreateSettings(userId);
  }

  async updateMySettings(
    userId: string,
    dto: UpdateUserSettingsDto,
  ): Promise<UserSetting> {
    const settings = await this.getOrCreateSettings(userId);

    settings.unitSystem = dto.unitSystem ?? settings.unitSystem;

    return this.userSettingRepository.save(settings);
  }

  private async getOrCreateSettings(userId: string): Promise<UserSetting> {
    const existingSettings = await this.userSettingRepository.findOne({
      where: {
        userId,
      },
    });

    if (existingSettings) {
      return existingSettings;
    }

    const settings = this.userSettingRepository.create({
      userId,
      unitSystem: UnitSystem.METRIC,
    });

    return this.userSettingRepository.save(settings);
  }
}

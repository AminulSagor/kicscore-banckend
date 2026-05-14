import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';
import { DeactivateDeviceTokenDto } from './dto/deactivate-device-token.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { DeviceToken } from './entities/device-token.entity';

@Injectable()
export class DeviceTokensService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async register(
    dto: RegisterDeviceTokenDto,
    user: JwtPayload | null,
  ): Promise<DeviceToken> {
    const now = new Date();

    let deviceToken = await this.deviceTokenRepository.findOne({
      where: {
        token: dto.token,
      },
    });

    if (!deviceToken) {
      deviceToken = this.deviceTokenRepository.create({
        token: dto.token,
      });
    }

    deviceToken.platform = dto.platform;
    deviceToken.installationId = dto.installationId;
    deviceToken.userId = user?.sub ?? null;
    deviceToken.appVersion = dto.appVersion ?? null;
    deviceToken.deviceModel = dto.deviceModel ?? null;
    deviceToken.osVersion = dto.osVersion ?? null;
    deviceToken.locale = dto.locale ?? null;
    deviceToken.timezone = dto.timezone ?? null;
    deviceToken.isActive = true;
    deviceToken.lastSeenAt = now;

    return this.deviceTokenRepository.save(deviceToken);
  }

  async deactivate(
    dto: DeactivateDeviceTokenDto,
    user: JwtPayload | null,
  ): Promise<void> {
    const deviceToken = await this.deviceTokenRepository.findOne({
      where: {
        token: dto.token,
      },
    });

    if (!deviceToken) {
      return;
    }

    if (
      dto.installationId &&
      deviceToken.installationId !== dto.installationId
    ) {
      return;
    }

    if (user?.sub && deviceToken.userId && deviceToken.userId !== user.sub) {
      return;
    }

    deviceToken.isActive = false;
    deviceToken.lastSeenAt = new Date();

    await this.deviceTokenRepository.save(deviceToken);
  }

  async findMyActiveTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  async findActiveTokensByUserId(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  async findActiveTokensByInstallationId(
    installationId: string,
  ): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: {
        installationId,
        isActive: true,
      },
    });
  }

  async deactivateById(deviceTokenId: string): Promise<void> {
    await this.deviceTokenRepository.update(
      { id: deviceTokenId },
      {
        isActive: false,
        lastSeenAt: new Date(),
      },
    );
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';
import { GetEntityNotificationSettingQueryDto } from './dto/get-entity-notification-setting-query.dto';
import { GetNotificationPreferenceQueryDto } from './dto/get-notification-preference-query.dto';
import { UpdateEntityNotificationSettingDto } from './dto/update-entity-notification-setting.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { EntityNotificationSetting } from './entities/entity-notification-setting.entity';
import { NotificationPreference } from './entities/notification-preference.entity';

interface NotificationOwner {
  userId: string | null;
  installationId: string | null;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,

    @InjectRepository(EntityNotificationSetting)
    private readonly entitySettingRepository: Repository<EntityNotificationSetting>,
  ) {}

  async getPreference(
    query: GetNotificationPreferenceQueryDto,
    user: JwtPayload | null,
  ): Promise<NotificationPreference> {
    const owner = this.resolveOwner(user, query.installationId);

    return this.getOrCreatePreference(owner);
  }

  async updatePreference(
    dto: UpdateNotificationPreferenceDto,
    user: JwtPayload | null,
  ): Promise<NotificationPreference> {
    const owner = this.resolveOwner(user, dto.installationId);
    const preference = await this.getOrCreatePreference(owner);

    preference.pushEnabled = dto.pushEnabled ?? preference.pushEnabled;
    preference.inAppEnabled = dto.inAppEnabled ?? preference.inAppEnabled;
    preference.matchAlertsEnabled =
      dto.matchAlertsEnabled ?? preference.matchAlertsEnabled;
    preference.teamAlertsEnabled =
      dto.teamAlertsEnabled ?? preference.teamAlertsEnabled;
    preference.leagueAlertsEnabled =
      dto.leagueAlertsEnabled ?? preference.leagueAlertsEnabled;
    preference.playerAlertsEnabled =
      dto.playerAlertsEnabled ?? preference.playerAlertsEnabled;
    preference.newsEnabled = dto.newsEnabled ?? preference.newsEnabled;
    preference.dailyDigestEnabled =
      dto.dailyDigestEnabled ?? preference.dailyDigestEnabled;
    preference.weeklyDigestEnabled =
      dto.weeklyDigestEnabled ?? preference.weeklyDigestEnabled;
    preference.quietHoursEnabled =
      dto.quietHoursEnabled ?? preference.quietHoursEnabled;
    preference.quietHoursStart =
      dto.quietHoursStart ?? preference.quietHoursStart;
    preference.quietHoursEnd = dto.quietHoursEnd ?? preference.quietHoursEnd;
    preference.timezone = dto.timezone ?? preference.timezone;

    return this.preferenceRepository.save(preference);
  }

  async getEntitySetting(
    query: GetEntityNotificationSettingQueryDto,
    user: JwtPayload | null,
  ): Promise<EntityNotificationSetting> {
    const owner = this.resolveOwner(user, query.installationId);

    return this.getOrCreateEntitySetting({
      owner,
      entityType: query.entityType,
      entityId: query.entityId,
    });
  }

  async updateEntitySetting(
    dto: UpdateEntityNotificationSettingDto,
    user: JwtPayload | null,
  ): Promise<EntityNotificationSetting> {
    const owner = this.resolveOwner(user, dto.installationId);

    const setting = await this.getOrCreateEntitySetting({
      owner,
      entityType: dto.entityType,
      entityId: dto.entityId,
    });

    setting.notificationsEnabled =
      dto.notificationsEnabled ?? setting.notificationsEnabled;
    setting.kickoffEnabled = dto.kickoffEnabled ?? setting.kickoffEnabled;
    setting.matchStartedEnabled =
      dto.matchStartedEnabled ?? setting.matchStartedEnabled;
    setting.goalEnabled = dto.goalEnabled ?? setting.goalEnabled;
    setting.redCardEnabled = dto.redCardEnabled ?? setting.redCardEnabled;
    setting.halfTimeEnabled = dto.halfTimeEnabled ?? setting.halfTimeEnabled;
    setting.fullTimeEnabled = dto.fullTimeEnabled ?? setting.fullTimeEnabled;
    setting.lineupEnabled = dto.lineupEnabled ?? setting.lineupEnabled;
    setting.transferEnabled = dto.transferEnabled ?? setting.transferEnabled;
    setting.injuryEnabled = dto.injuryEnabled ?? setting.injuryEnabled;
    setting.newsEnabled = dto.newsEnabled ?? setting.newsEnabled;

    return this.entitySettingRepository.save(setting);
  }

  private async getOrCreatePreference(
    owner: NotificationOwner,
  ): Promise<NotificationPreference> {
    const existingPreference = await this.preferenceRepository.findOne({
      where: this.getOwnerWhere(owner),
    });

    if (existingPreference) {
      return existingPreference;
    }

    const preference = this.preferenceRepository.create({
      userId: owner.userId,
      installationId: owner.installationId,
    });

    return this.preferenceRepository.save(preference);
  }

  private async getOrCreateEntitySetting(params: {
    owner: NotificationOwner;
    entityType: EntityNotificationSetting['entityType'];
    entityId: string;
  }): Promise<EntityNotificationSetting> {
    const existingSetting = await this.entitySettingRepository.findOne({
      where: {
        ...this.getOwnerWhere(params.owner),
        entityType: params.entityType,
        entityId: String(params.entityId),
      },
    });

    if (existingSetting) {
      return existingSetting;
    }

    const setting = this.entitySettingRepository.create({
      userId: params.owner.userId,
      installationId: params.owner.installationId,
      entityType: params.entityType,
      entityId: String(params.entityId),
    });

    return this.entitySettingRepository.save(setting);
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
  ): FindOptionsWhere<NotificationPreference> &
    FindOptionsWhere<EntityNotificationSetting> {
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

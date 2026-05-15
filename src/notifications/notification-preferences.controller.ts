import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { ControllerResponse } from '../common/interfaces/api-response.interface';
import { OptionalJwtAuthGuard } from '../modules/auth/guards/optional-jwt-auth.guard';
import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';
import { GetEntityNotificationSettingQueryDto } from './dto/get-entity-notification-setting-query.dto';
import { GetNotificationPreferenceQueryDto } from './dto/get-notification-preference-query.dto';
import { UpdateEntityNotificationSettingDto } from './dto/update-entity-notification-setting.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { EntityNotificationSetting } from './entities/entity-notification-setting.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateMatchAlertsDto } from './dto/update-match-alerts.dto';

interface RequestWithOptionalUser {
  user?: JwtPayload;
}

@Controller('notifications')
export class NotificationPreferencesController {
  constructor(
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('preferences')
  async getPreference(
    @Query() query: GetNotificationPreferenceQueryDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<NotificationPreference>> {
    const data = await this.notificationPreferencesService.getPreference(
      query,
      request.user ?? null,
    );

    return {
      message: 'Notification preferences fetched successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('preferences')
  async updatePreference(
    @Body() dto: UpdateNotificationPreferenceDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<NotificationPreference>> {
    const data = await this.notificationPreferencesService.updatePreference(
      dto,
      request.user ?? null,
    );

    return {
      message: 'Notification preferences updated successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('entity-settings')
  async getEntitySetting(
    @Query() query: GetEntityNotificationSettingQueryDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<EntityNotificationSetting>> {
    const data = await this.notificationPreferencesService.getEntitySetting(
      query,
      request.user ?? null,
    );

    return {
      message: 'Entity notification setting fetched successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('entity-settings')
  async updateEntitySetting(
    @Body() dto: UpdateEntityNotificationSettingDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<EntityNotificationSetting>> {
    const data = await this.notificationPreferencesService.updateEntitySetting(
      dto,
      request.user ?? null,
    );

    return {
      message: 'Entity notification setting updated successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('preferences/match-alerts')
  async updateMatchAlerts(
    @Body() dto: UpdateMatchAlertsDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<NotificationPreference>> {
    const data = await this.notificationPreferencesService.updatePreference(
      {
        installationId: dto.installationId,
        matchAlertsEnabled: dto.matchAlertsEnabled,
      },
      request.user ?? null,
    );

    return {
      message: 'Match alerts preference updated successfully',
      data,
    };
  }
}

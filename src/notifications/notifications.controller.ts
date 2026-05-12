import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { ControllerResponse } from '../common/interfaces/api-response.interface';
import { OptionalJwtAuthGuard } from '../modules/auth/guards/optional-jwt-auth.guard';
import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsService } from './notifications.service';
import { TestSendNotificationDto } from './dto/test-send-notification.dto';

interface RequestWithOptionalUser {
  user?: JwtPayload;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getNotifications(
    @Query() query: GetNotificationsQueryDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<
    ControllerResponse<{
      items: UserNotification[];
      meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>
  > {
    const data = await this.notificationsService.getNotifications(
      query,
      request.user ?? null,
    );

    return {
      message: 'Notifications fetched successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('read-all')
  async markAllAsRead(
    @Query('installationId') installationId: string | undefined,
    @Req() request: RequestWithOptionalUser,
  ): Promise<
    ControllerResponse<{
      updatedCount: number;
    }>
  > {
    const data = await this.notificationsService.markAllAsRead(
      { installationId },
      request.user ?? null,
    );

    return {
      message: 'All notifications marked as read successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':notificationId/read')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Query('installationId') installationId: string | undefined,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<UserNotification>> {
    const data = await this.notificationsService.markAsRead(
      notificationId,
      { installationId },
      request.user ?? null,
    );

    return {
      message: 'Notification marked as read successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('test-send')
  async testSend(
    @Body() dto: TestSendNotificationDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<
    ControllerResponse<{
      notification: UserNotification;
      totalTokens: number;
      sentCount: number;
      failedCount: number;
    }>
  > {
    const data = await this.notificationsService.testSend(
      dto,
      request.user ?? null,
    );

    return {
      message: 'Test notification processed successfully',
      data,
    };
  }
}

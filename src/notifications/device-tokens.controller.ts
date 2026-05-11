import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ControllerResponse } from '../common/interfaces/api-response.interface';
import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';
import { OptionalJwtAuthGuard } from '../modules/auth/guards/optional-jwt-auth.guard';
import { DeactivateDeviceTokenDto } from './dto/deactivate-device-token.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { DeviceTokensService } from './device-tokens.service';

interface RequestWithOptionalUser {
  user?: JwtPayload;
}

@Controller('device-tokens')
export class DeviceTokensController {
  constructor(private readonly deviceTokensService: DeviceTokensService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('register')
  async register(
    @Body() dto: RegisterDeviceTokenDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.deviceTokensService.register(
      dto,
      request.user ?? null,
    );

    return {
      message: 'Device token registered successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('deactivate')
  async deactivate(
    @Body() dto: DeactivateDeviceTokenDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<null>> {
    await this.deviceTokensService.deactivate(dto, request.user ?? null);

    return {
      message: 'Device token deactivated successfully',
      data: null,
    };
  }

  @Get('me')
  async getMyDeviceTokens(
    @CurrentUser() user: JwtPayload,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.deviceTokensService.findMyActiveTokens(user.sub);

    return {
      message: 'Device tokens fetched successfully',
      data,
    };
  }
}

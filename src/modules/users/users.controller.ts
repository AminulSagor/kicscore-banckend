import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ControllerResponse } from '../../common/interfaces/api-response.interface';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
  UpdateProfileDto,
  UpdateProfilePhotoDto,
} from './dto/update-profile.dto';
import { UsersService } from './users.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(
    @CurrentUser() user: JwtPayload,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.usersService.getMe(user.sub);

    return {
      message: 'Profile fetched successfully',
      data,
    };
  }

  @Patch('me/profile')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.usersService.updateProfile(user.sub, dto);

    return {
      message: 'Profile updated successfully',
      data,
    };
  }

  @Patch('me/profile-photo')
  async updateProfilePhoto(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfilePhotoDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.usersService.updateProfilePhoto(user.sub, dto);

    return {
      message: 'Profile photo updated successfully',
      data,
    };
  }

  @Post('me/delete-account')
  async deleteAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ): Promise<ControllerResponse<null>> {
    await this.usersService.deleteAccount(user.sub, dto);

    return {
      message: 'Account deleted successfully',
      data: null,
    };
  }

  @Patch('me/password')
  async changeMyPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<ControllerResponse<null>> {
    const data = await this.usersService.changeMyPassword(user.sub, dto);

    return {
      message: 'Password changed successfully',
      data,
    };
  }

  @Get('me/settings')
  async getMySettings(
    @CurrentUser() user: JwtPayload,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.usersService.getMySettings(user.sub);

    return {
      message: 'Settings fetched successfully',
      data,
    };
  }

  @Patch('me/settings')
  async updateMySettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserSettingsDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.usersService.updateMySettings(user.sub, dto);

    return {
      message: 'Settings updated successfully',
      data,
    };
  }
}

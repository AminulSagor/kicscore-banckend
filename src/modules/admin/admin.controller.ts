import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ControllerResponse } from 'src/common/interfaces/api-response.interface';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { AdminService } from './admin.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { CreateAdminProfileDto } from './dto/create-admin-profile.dto';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/overview')
  async getDashboardOverview(): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.getDashboardOverview();

    return {
      message: 'Dashboard overview fetched successfully',
      data,
    };
  }

  @Get('dashboard/top-leagues')
  async getTopLeagues(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.getTopFollowedLeagues(page, limit);

    return {
      message: 'Top followed leagues fetched successfully',
      data,
    };
  }

  @Get('dashboard/top-teams')
  async getTopTeams(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.getTopFollowedTeams(page, limit);

    return {
      message: 'Top followed teams fetched successfully',
      data,
    };
  }

  @Get('dashboard/export')
  exportDashboardReport() {
    return this.adminService.exportDashboardReport();
  }

  @Get('users')
  async getUsers(
    @Query() query: AdminUsersQueryDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.getUsers(query);

    return {
      message: 'Users fetched successfully',
      data,
    };
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @CurrentUser() adminUser: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.updateUserStatus(
      adminUser.sub,
      userId,
      dto,
    );

    return {
      message: 'User status updated successfully',
      data,
    };
  }

  @Delete('users/:userId')
  async deleteUser(
    @CurrentUser() adminUser: JwtPayload,
    @Param('userId') userId: string,
  ): Promise<ControllerResponse<null>> {
    const data = await this.adminService.deleteUser(adminUser.sub, userId);

    return {
      message: 'User deleted successfully',
      data,
    };
  }

  @Post('profile')
  async createAdminProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdminProfileDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.createMyAdminProfile(user.sub, dto);

    return {
      message: 'Admin profile created successfully',
      data,
    };
  }

  @Get('profile/me')
  async getMyAdminProfile(
    @CurrentUser() user: JwtPayload,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.getMyAdminProfile(user.sub);

    return {
      message: 'Admin profile fetched successfully',
      data,
    };
  }

  @Patch('profile/me')
  async updateMyAdminProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAdminProfileDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.updateMyAdminProfile(user.sub, dto);

    return {
      message: 'Admin profile updated successfully',
      data,
    };
  }

  @Delete('profile/me')
  async deleteMyAdminProfile(
    @CurrentUser() user: JwtPayload,
  ): Promise<ControllerResponse<null>> {
    const data = await this.adminService.deleteMyAdminProfile(user.sub);

    return {
      message: 'Admin profile deleted successfully',
      data,
    };
  }
}

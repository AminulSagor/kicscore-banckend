import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ControllerResponse } from 'src/common/interfaces/api-response.interface';
import { Public } from 'src/common/decorators/public.decorator';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { AdminService } from './admin.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { CreateAdminProfileDto } from './dto/create-admin-profile.dto';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(AdminGuard)
  @Get('dashboard/overview')
  async getDashboardOverview(): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.getDashboardOverview();

    return {
      message: 'Dashboard overview fetched successfully',
      data,
    };
  }

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
  @Get('dashboard/export')
  exportDashboardReport() {
    return this.adminService.exportDashboardReport();
  }

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
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

  // Temporary admin seeder API
  @Public()
  @Post('profile')
  async createAdminProfile(
    @Headers('x-admin-create-secret') secret: string | undefined,
    @Body() dto: CreateAdminProfileDto,
  ): Promise<ControllerResponse<unknown>> {
    const data = await this.adminService.createAdminUser(dto, secret);

    return {
      message: 'Admin user created successfully',
      data,
    };
  }

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
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

  @UseGuards(AdminGuard)
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

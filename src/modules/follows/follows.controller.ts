import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { Public } from 'src/common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ControllerResponse } from 'src/common/interfaces/api-response.interface';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreateFollowDto } from './dto/create-follow.dto';
import { FollowStatusQueryDto } from './dto/follow-status-query.dto';
import { GetFollowsQueryDto } from './dto/get-follows-query.dto';
import { MergeAnonymousFollowsDto } from './dto/merge-anonymous-follows.dto';
import { Follow } from './entities/follow.entity';
import { FollowEntityType } from './enums/follow-entity-type.enum';
import { FollowsService } from './follows.service';

interface RequestWithOptionalUser {
  user?: JwtPayload;
}

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async follow(
    @Body() dto: CreateFollowDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<Follow>> {
    const data = await this.followsService.follow(dto, request.user ?? null);

    return {
      message: 'Followed successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getFollows(
    @Query() query: GetFollowsQueryDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<Follow[]>> {
    const data = await this.followsService.getMyFollows(
      query,
      request.user ?? null,
    );

    return {
      message: 'Follows fetched successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('status')
  async getFollowStatus(
    @Query() query: FollowStatusQueryDto,
    @Req() request: RequestWithOptionalUser,
  ): Promise<
    ControllerResponse<{
      followed: boolean;
      follow: Follow | null;
    }>
  > {
    const data = await this.followsService.getFollowStatus(
      query,
      request.user ?? null,
    );

    return {
      message: 'Follow status fetched successfully',
      data,
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete(':entityType/:entityId')
  async unfollow(
    @Param('entityType', new ParseEnumPipe(FollowEntityType))
    entityType: FollowEntityType,
    @Param('entityId') entityId: string,
    @Query('installationId') installationId: string | undefined,
    @Req() request: RequestWithOptionalUser,
  ): Promise<ControllerResponse<null>> {
    await this.followsService.unfollow({
      entityType,
      entityId,
      installationId,
      user: request.user ?? null,
    });

    return {
      message: 'Unfollowed successfully',
      data: null,
    };
  }

  @Post('merge-anonymous')
  async mergeAnonymousFollows(
    @Body() dto: MergeAnonymousFollowsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<
    ControllerResponse<{
      mergedCount: number;
    }>
  > {
    const data = await this.followsService.mergeAnonymousFollows(
      dto.installationId,
      user,
    );

    return {
      message: 'Anonymous follows merged successfully',
      data,
    };
  }
}

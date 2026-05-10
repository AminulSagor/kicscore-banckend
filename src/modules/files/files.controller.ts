import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ControllerResponse } from '../../common/interfaces/api-response.interface';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { FilesService } from './files.service';
import {
  FileResponse,
  SignedReadUrlResponse,
  SignedUploadUrlResponse,
} from './types/file-response.type';
import { CreateSignedUploadUrlDto } from './dto/create-signed-upload-url.dto.ts';
import { ConfirmFileUploadDto } from './dto/confirm-upload.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('signed-upload-url')
  async createSignedUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSignedUploadUrlDto,
  ): Promise<ControllerResponse<SignedUploadUrlResponse>> {
    const data = await this.filesService.createSignedUploadUrl(user.sub, dto);

    return {
      message: 'Signed upload URL created successfully',
      data,
    };
  }

  @Post('confirm-upload')
  async confirmUpload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmFileUploadDto,
  ): Promise<ControllerResponse<FileResponse>> {
    const data = await this.filesService.confirmUpload(user.sub, dto);

    return {
      message: 'File upload confirmed successfully',
      data,
    };
  }

  @Get(':fileId/signed-read-url')
  async createSignedReadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
  ): Promise<ControllerResponse<SignedReadUrlResponse>> {
    const data = await this.filesService.createSignedReadUrl(user.sub, fileId);

    return {
      message: 'Signed read URL created successfully',
      data,
    };
  }

  @Delete(':fileId')
  async deleteFile(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
  ): Promise<ControllerResponse<null>> {
    await this.filesService.deleteFile(user.sub, fileId);

    return {
      message: 'File deleted successfully',
      data: null,
    };
  }
}

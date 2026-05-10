import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { S3Service } from '../aws/s3.service';
import { FileEntity } from './entities/file.entity';
import { FileStatus } from './enums/file-status.enum';
import {
  FileResponse,
  SignedReadUrlResponse,
  SignedUploadUrlResponse,
} from './types/file-response.type';
import { CreateSignedUploadUrlDto } from './dto/create-signed-upload-url.dto.ts';
import { ConfirmFileUploadDto } from './dto/confirm-upload.dto';

@Injectable()
export class FilesService {
  constructor(
    private readonly s3Service: S3Service,

    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async createSignedUploadUrl(
    userId: string,
    dto: CreateSignedUploadUrlDto,
  ): Promise<SignedUploadUrlResponse> {
    const bucket = this.s3Service.getBucketName();
    const region = this.s3Service.getRegion();
    const fileKey = this.buildFileKey(userId, dto);

    const signedUrlResult = await this.s3Service.createSignedUploadUrl({
      fileKey,
      contentType: dto.contentType,
    });

    const uploadUrlExpiresAt = new Date(
      Date.now() + signedUrlResult.expiresInSeconds * 1000,
    );

    const file = this.fileRepository.create({
      ownerUserId: userId,
      bucket,
      region,
      fileKey,
      originalFileName: dto.fileName,
      mimeType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      folder: dto.folder,
      status: FileStatus.PENDING,
      uploadUrlExpiresAt,
      uploadedAt: null,
      deletedAt: null,
    });

    const savedFile = await this.fileRepository.save(file);

    return {
      fileId: savedFile.id,
      fileKey: savedFile.fileKey,
      uploadUrl: signedUrlResult.signedUrl,
      expiresInSeconds: signedUrlResult.expiresInSeconds,
      method: 'PUT',
      headers: {
        'Content-Type': dto.contentType,
      },
    };
  }

  async confirmUpload(
    userId: string,
    dto: ConfirmFileUploadDto,
  ): Promise<FileResponse> {
    const file = await this.fileRepository.findOne({
      where: {
        id: dto.fileId,
        ownerUserId: userId,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status !== FileStatus.PENDING) {
      throw new BadRequestException('File is already confirmed');
    }

    if (file.uploadUrlExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Upload URL has expired');
    }

    const metadata = await this.s3Service.getObjectMetadata(file.fileKey);

    if (!metadata) {
      throw new BadRequestException('File was not uploaded to S3');
    }

    if (metadata.sizeBytes !== file.sizeBytes) {
      throw new BadRequestException('Uploaded file size does not match');
    }

    if (metadata.contentType.toLowerCase() !== file.mimeType.toLowerCase()) {
      throw new BadRequestException('Uploaded file type does not match');
    }

    file.status = FileStatus.UPLOADED;
    file.uploadedAt = new Date();

    const savedFile = await this.fileRepository.save(file);

    return this.toFileResponse(savedFile);
  }

  async createSignedReadUrl(
    userId: string,
    fileId: string,
  ): Promise<SignedReadUrlResponse> {
    const file = await this.fileRepository.findOne({
      where: {
        id: fileId,
        ownerUserId: userId,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status !== FileStatus.UPLOADED) {
      throw new BadRequestException('File is not uploaded yet');
    }

    const signedUrlResult = await this.s3Service.createSignedReadUrl(
      file.fileKey,
    );

    return {
      fileId: file.id,
      fileKey: file.fileKey,
      readUrl: signedUrlResult.signedUrl,
      expiresInSeconds: signedUrlResult.expiresInSeconds,
    };
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: {
        id: fileId,
        ownerUserId: userId,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status === FileStatus.DELETED) {
      return;
    }

    await this.s3Service.deleteObject(file.fileKey);

    file.status = FileStatus.DELETED;
    file.deletedAt = new Date();

    await this.fileRepository.save(file);
  }

  private buildFileKey(userId: string, dto: CreateSignedUploadUrlDto): string {
    const safeFileName = dto.fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase();

    return `${dto.folder}/${userId}/${uuidv4()}-${safeFileName}`;
  }

  private toFileResponse(file: FileEntity): FileResponse {
    return {
      id: file.id,
      fileKey: file.fileKey,
      originalFileName: file.originalFileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      folder: file.folder,
      status: file.status,
      uploadedAt: file.uploadedAt,
    };
  }
}

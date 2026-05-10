import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CreateSignedUploadUrlParams {
  fileKey: string;
  contentType: string;
}

interface SignedUrlResult {
  signedUrl: string;
  expiresInSeconds: number;
}

interface S3ObjectMetadata {
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly uploadExpiresInSeconds: number;
  private readonly readExpiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('AWS_REGION');
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');

    this.uploadExpiresInSeconds = Number(
      this.configService.get<string>('AWS_SIGNED_UPLOAD_EXPIRES_SECONDS') ??
        300,
    );

    this.readExpiresInSeconds = Number(
      this.configService.get<string>('AWS_SIGNED_READ_EXPIRES_SECONDS') ?? 900,
    );

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  getBucketName(): string {
    return this.bucket;
  }

  getRegion(): string {
    return this.region;
  }

  async createSignedUploadUrl(
    params: CreateSignedUploadUrlParams,
  ): Promise<SignedUrlResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.fileKey,
      ContentType: params.contentType,
    });

    const signedUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.uploadExpiresInSeconds,
    });

    return {
      signedUrl,
      expiresInSeconds: this.uploadExpiresInSeconds,
    };
  }

  async createSignedReadUrl(fileKey: string): Promise<SignedUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.readExpiresInSeconds,
    });

    return {
      signedUrl,
      expiresInSeconds: this.readExpiresInSeconds,
    };
  }

  async getObjectMetadata(fileKey: string): Promise<S3ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );

      return {
        contentType: result.ContentType ?? 'application/octet-stream',
        sizeBytes: result.ContentLength ?? 0,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(fileKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      }),
    );
  }
}

import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class TestSendNotificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;

  @IsString()
  @MaxLength(160)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

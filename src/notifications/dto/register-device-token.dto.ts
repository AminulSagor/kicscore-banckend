import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { DevicePlatform } from '../enums/device-platform.enum';

export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsString()
  @MaxLength(120)
  installationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  osVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

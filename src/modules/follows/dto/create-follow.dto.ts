import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { FollowEntityType } from '../enums/follow-entity-type.enum';

export class CreateFollowDto {
  @IsEnum(FollowEntityType)
  entityType: FollowEntityType;

  @IsString()
  @MaxLength(80)
  entityId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  entityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  entityLogo?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;
}

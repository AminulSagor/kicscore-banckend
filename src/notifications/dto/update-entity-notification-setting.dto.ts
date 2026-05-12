import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

export class UpdateEntityNotificationSettingDto {
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
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  kickoffEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  matchStartedEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  goalEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  redCardEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  halfTimeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  fullTimeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  lineupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  transferEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  injuryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  newsEnabled?: boolean;
}

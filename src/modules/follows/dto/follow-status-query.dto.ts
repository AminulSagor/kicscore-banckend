import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { FollowEntityType } from '../enums/follow-entity-type.enum';

export class FollowStatusQueryDto {
  @IsEnum(FollowEntityType)
  entityType: FollowEntityType;

  @IsString()
  @MaxLength(80)
  entityId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;
}

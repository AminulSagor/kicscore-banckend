import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { FollowEntityType } from '../enums/follow-entity-type.enum';

export class GetFollowsQueryDto {
  @IsOptional()
  @IsEnum(FollowEntityType)
  entityType?: FollowEntityType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;
}

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

export class GetEntityNotificationSettingQueryDto {
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

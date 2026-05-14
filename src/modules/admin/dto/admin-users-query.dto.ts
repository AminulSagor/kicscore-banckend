import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { UserStatus } from '../../users/enums/user-status.enum';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminUsersQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  limit?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn([
    UserStatus.PENDING_VERIFICATION,
    UserStatus.ACTIVE,
    UserStatus.SUSPENDED,
    UserStatus.DELETED,
  ])
  status?: UserStatus;
}

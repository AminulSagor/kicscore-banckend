import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GetNotificationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isRead?: 'true' | 'false';
}

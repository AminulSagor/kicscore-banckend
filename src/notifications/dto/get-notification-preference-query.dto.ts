import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GetNotificationPreferenceQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;
}

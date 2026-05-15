import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMatchAlertsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;

  @IsBoolean()
  matchAlertsEnabled: boolean;
}

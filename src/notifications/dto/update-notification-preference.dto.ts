import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  matchAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  teamAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  leagueAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  playerAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  newsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietHoursStart?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietHoursEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

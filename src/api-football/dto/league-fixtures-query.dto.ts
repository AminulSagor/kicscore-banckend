import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const uppercaseString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : undefined;
};

export class LeagueFixturesQueryDto {
  @Transform(trimString)
  @IsDateString()
  date: string;

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
  timezone?: string;

  @IsOptional()
  @Transform(uppercaseString)
  @IsIn(['ALL', 'LIVE', 'UPCOMING', 'FINISHED'])
  statusGroup?: 'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED';
}

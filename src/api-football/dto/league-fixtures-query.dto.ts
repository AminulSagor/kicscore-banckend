import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
}

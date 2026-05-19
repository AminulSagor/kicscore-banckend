import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const NUMBER_REGEX = /^\d+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class FootballCompositeQueryDto {
  [key: string]: string | number | boolean | undefined;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  limit?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  season?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  league?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  team?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  last?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  next?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  fromSeason?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  toSeason?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(DATE_REGEX)
  from?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(DATE_REGEX)
  to?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  country?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn(['TEAM', 'LEAGUE', 'PLAYER'])
  entityType?: 'TEAM' | 'LEAGUE' | 'PLAYER';
}

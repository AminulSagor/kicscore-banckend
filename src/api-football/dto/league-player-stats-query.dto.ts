import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const NUMBER_REGEX = /^\d+$/;

export enum LeaguePlayerStatsCategory {
  MINUTES = 'minutes',
  ATTACK = 'attack',
  DEFENSE = 'defense',
  GOALKEEPING = 'goalkeeping',
  DISCIPLINE = 'discipline',
}

export class LeaguePlayerStatsQueryDto {
  [key: string]: string | number | boolean | undefined;

  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  season: string;

  @Transform(trimString)
  @IsIn([
    LeaguePlayerStatsCategory.MINUTES,
    LeaguePlayerStatsCategory.ATTACK,
    LeaguePlayerStatsCategory.DEFENSE,
    LeaguePlayerStatsCategory.GOALKEEPING,
    LeaguePlayerStatsCategory.DISCIPLINE,
  ])
  category: LeaguePlayerStatsCategory;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  limit?: string;
}

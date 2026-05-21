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

export enum LeagueTeamStatsCategory {
  TOP_STATS = 'topStats',
  ATTACK = 'attack',
  DEFENSE = 'defense',
  DISCIPLINE = 'discipline',
}

export class LeagueTeamStatsQueryDto {
  [key: string]: string | number | boolean | undefined;

  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  season: string;

  @Transform(trimString)
  @IsIn([
    LeagueTeamStatsCategory.TOP_STATS,
    LeagueTeamStatsCategory.ATTACK,
    LeagueTeamStatsCategory.DEFENSE,
    LeagueTeamStatsCategory.DISCIPLINE,
  ])
  category: LeagueTeamStatsCategory;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  limit?: string;
}

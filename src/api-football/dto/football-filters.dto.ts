import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class FixturesQueryDto {
  [key: string]: string | number | boolean | undefined;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(3, 100)
  h2h?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  live?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  ids?: string;

  @IsOptional()
  @Transform(trimString)
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  league?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  season?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  team?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  venue?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  next?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  last?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  round?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 60)
  timezone?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn(['NS', 'TBD', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'FT', 'AET', 'PEN', 'PSO', 'CANC', 'ABD', 'AWD', 'WO'])
  status?: string;

  @IsOptional()
  @Transform(trimString)
  @IsDateString()
  from?: string;

  @IsOptional()
  @Transform(trimString)
  @IsDateString()
  to?: string;
}

export class TeamsQueryDto {
  [key: string]: string | number | boolean | undefined;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  id?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  league?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  season?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(3, 100)
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  team?: string;
}

export class PlayersQueryDto {
  [key: string]: string | number | boolean | undefined;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  team?: string;

  @IsOptional()
  @Transform(trimString)
  @IsNumberString()
  season?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(3, 100)
  search?: string;
}

export class SearchQueryDto {
  [key: string]: string | number | boolean | undefined;

  @Transform(trimString)
  @IsString()
  @Length(3, 100)
  q!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 20)
  season!: string;
}
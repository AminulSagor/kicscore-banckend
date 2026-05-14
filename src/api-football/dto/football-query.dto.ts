import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const NUMBER_REGEX = /^\d+$/;
const NUMBER_LIST_REGEX = /^\d+(-\d+)*$/;
const LIVE_REGEX = /^(all|\d+(-\d+)*)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

export class FootballQueryDto {
  [key: string]: string | number | boolean | undefined;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  id?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_LIST_REGEX)
  ids?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(LIVE_REGEX)
  live?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(DATE_REGEX)
  date?: string;

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
  @Matches(NUMBER_REGEX)
  league?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  season?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  team?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  player?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  coach?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  fixture?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  venue?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  next?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  last?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  timezone?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  round?: string;

  @IsOptional()
  @Transform(uppercaseString)
  @IsIn([
    'NS',
    'TBD',
    '1H',
    'HT',
    '2H',
    'ET',
    'BT',
    'P',
    'SUSP',
    'INT',
    'FT',
    'AET',
    'PEN',
    'PSO',
    'CANC',
    'ABD',
    'AWD',
    'WO',
  ])
  status?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn(['true', 'false'])
  current?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_LIST_REGEX)
  h2h?: string;
}

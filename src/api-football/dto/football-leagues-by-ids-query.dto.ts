import { Transform } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';

const NUMBER_REGEX = /^\d+$/;
const NUMBER_LIST_REGEX = /^\d+(-\d+)*$/;

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeNumberList = ({ value }: { value: unknown }): unknown => {
  if (Array.isArray(value)) {
    return value.join('-');
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/\s+/g, '').replace(/,/g, '-');
  return normalized.length > 0 ? normalized : undefined;
};

export class FootballLeaguesByIdsQueryDto {
  [key: string]: string | number | boolean | undefined;

  @Transform(normalizeNumberList)
  @Matches(NUMBER_LIST_REGEX)
  ids!: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  season?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn(['true', 'false'])
  current?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  limit?: string;
}

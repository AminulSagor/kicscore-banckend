import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { FeaturedTeamSection } from 'src/common/constants/featured-football.constant';

const NUMBER_REGEX = /^\d+$/;

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export class TopTeamsQueryDto {
  @IsOptional()
  @IsEnum(FeaturedTeamSection)
  section?: FeaturedTeamSection;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  limit?: string;
}

export class TopPlayersQueryDto {
  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  page?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(NUMBER_REGEX)
  limit?: string;
}

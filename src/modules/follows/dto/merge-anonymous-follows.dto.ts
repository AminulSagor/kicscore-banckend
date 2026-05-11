import { IsString, MaxLength } from 'class-validator';

export class MergeAnonymousFollowsDto {
  @IsString()
  @MaxLength(120)
  installationId: string;
}

import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateCustomNewsDto {
  @IsString()
  @IsOptional()
  @MaxLength(700)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  snippet?: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsUUID()
  @IsOptional()
  imageId?: string;
}

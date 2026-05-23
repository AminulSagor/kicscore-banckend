import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCustomNewsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(700)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  snippet: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsUUID()
  @IsOptional()
  imageId?: string;
}

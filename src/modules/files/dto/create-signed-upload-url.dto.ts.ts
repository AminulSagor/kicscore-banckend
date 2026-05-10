import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { FileFolder } from '../enums/file-folder.enum';

export class CreateSignedUploadUrlDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9._\-\s()]+$/, {
    message: 'File name contains invalid characters',
  })
  fileName: string;

  @IsString()
  @MaxLength(120)
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes: number;

  @IsEnum(FileFolder)
  folder: FileFolder;
}

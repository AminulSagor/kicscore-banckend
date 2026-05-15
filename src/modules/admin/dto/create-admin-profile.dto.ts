import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminProfileDto {
  @IsString()
  @MaxLength(80)
  fullName: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(80)
  password: string;

  @IsOptional()
  @IsUUID()
  profilePhotoFileId?: string;
}

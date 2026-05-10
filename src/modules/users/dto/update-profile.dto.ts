import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[\p{L}\s'-]+$/u, {
    message:
      'Full name can contain only letters, spaces, hyphen, and apostrophe',
  })
  fullName: string;
}

export class UpdateProfilePhotoDto {
  @IsUUID()
  fileId: string;
}

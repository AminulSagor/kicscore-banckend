import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAdminProfileDto {
  @IsString()
  @MaxLength(80)
  fullName: string;

  @IsOptional()
  @IsUUID()
  profilePhotoFileId?: string;
}

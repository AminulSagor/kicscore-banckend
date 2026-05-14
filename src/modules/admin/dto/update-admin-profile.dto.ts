import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateAdminProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  profilePhotoFileId?: string;
}

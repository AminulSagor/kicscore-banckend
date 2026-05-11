import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateDeviceTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  installationId?: string;
}

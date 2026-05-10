import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName: string;
}

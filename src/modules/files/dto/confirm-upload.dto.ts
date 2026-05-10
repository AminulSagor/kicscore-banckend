import { IsUUID } from 'class-validator';

export class ConfirmFileUploadDto {
  @IsUUID()
  fileId: string;
}

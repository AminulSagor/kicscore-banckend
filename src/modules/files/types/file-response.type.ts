import { FileFolder } from '../enums/file-folder.enum';
import { FileStatus } from '../enums/file-status.enum';

export interface SignedUploadUrlResponse {
  fileId: string;
  fileKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  method: 'PUT';
  headers: {
    'Content-Type': string;
  };
}

export interface SignedReadUrlResponse {
  fileId: string;
  fileKey: string;
  readUrl: string;
  expiresInSeconds: number;
}

export interface FileResponse {
  id: string;
  fileKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  folder: FileFolder;
  status: FileStatus;
  uploadedAt: Date | null;
}

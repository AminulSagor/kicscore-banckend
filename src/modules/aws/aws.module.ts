import { Module } from '@nestjs/common';

import { S3Service } from './s3.service';
import { SesService } from './ses.service';
import { ZohoMailApiService } from './zoho-mail-api.service';

@Module({
  providers: [S3Service, SesService, ZohoMailApiService],
  exports: [S3Service, SesService, ZohoMailApiService],
})
export class AwsModule {}

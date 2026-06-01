import { Module } from '@nestjs/common';

import { S3Service } from './s3.service';
import { SesService } from './ses.service';
import { GmailSmtpService } from './gmail-smtp.service';

@Module({
  providers: [S3Service, SesService, GmailSmtpService],
  exports: [S3Service, SesService, GmailSmtpService],
})
export class AwsModule {}

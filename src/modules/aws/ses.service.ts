import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

import { OtpPurpose } from '../auth/enums/otp-purpose.enum';
import { GmailSmtpService } from './gmail-smtp.service';

@Injectable()
export class SesService {
  private readonly logger = new Logger(SesService.name);
  private readonly client: SESClient | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailSmtpService: GmailSmtpService,
  ) {
    this.client = this.shouldBypassSes()
      ? null
      : new SESClient({
          region: this.configService.getOrThrow<string>('AWS_REGION'),
          credentials: {
            accessKeyId:
              this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
            secretAccessKey: this.configService.getOrThrow<string>(
              'AWS_SECRET_ACCESS_KEY',
            ),
          },
        });
  }

  async sendOtpEmail(
    receiverEmail: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const subject =
      purpose === OtpPurpose.PASSWORD_RESET
        ? 'Reset your Kicscore password'
        : 'Verify your Kicscore email';

    const html = this.buildOtpTemplate(otp, purpose);

    if (this.shouldBypassSes()) {
      this.logger.log('Sending OTP email using Gmail SMTP fallback');

      await this.gmailSmtpService.sendEmail({
        to: receiverEmail,
        subject,
        html,
      });

      return;
    }

    if (!this.client) {
      throw new Error('AWS SES client is not initialized');
    }

    const fromEmail = this.configService.getOrThrow<string>('SES_FROM_EMAIL');

    await this.client.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [receiverEmail],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
          },
        },
      }),
    );
  }

  private shouldBypassSes(): boolean {
    return this.configService.get<string>('BYPASS_SES') === 'true';
  }

  private buildOtpTemplate(otp: string, purpose: OtpPurpose): string {
    const title =
      purpose === OtpPurpose.PASSWORD_RESET
        ? 'Reset your Kicscore password'
        : 'Verify your Kicscore email';

    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
        <h2>${title}</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;">
          ${otp}
        </div>
        <p>This code will expire soon. If you did not request this, please ignore this email.</p>
      </div>
    `;
  }
}

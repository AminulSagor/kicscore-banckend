import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

import { OtpPurpose } from '../auth/enums/otp-purpose.enum';

@Injectable()
export class SesService {
  private readonly client: SESClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new SESClient({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
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
    const fromEmail = this.configService.getOrThrow<string>('SES_FROM_EMAIL');

    const subject =
      purpose === OtpPurpose.PASSWORD_RESET
        ? 'Reset your Kicscore password'
        : 'Verify your Kicscore email';

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
              Data: this.buildOtpTemplate(otp),
              Charset: 'UTF-8',
            },
          },
        },
      }),
    );
  }

  private buildOtpTemplate(otp: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
        <h2>Kicscore Verification Code</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;">
          ${otp}
        </div>
        <p>This code will expire soon. If you did not request this, please ignore this email.</p>
      </div>
    `;
  }
}

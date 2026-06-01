import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

interface SendGmailEmailParams {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class GmailSmtpService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: SendGmailEmailParams): Promise<void> {
    const transporter = this.getTransporter();
    const fromEmail =
      this.configService.get<string>('GMAIL_SMTP_FROM_EMAIL') ??
      this.configService.getOrThrow<string>('GMAIL_SMTP_USER');

    const fromName =
      this.configService.get<string>('GMAIL_SMTP_FROM_NAME') ?? 'Kicscore';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const user = this.configService.getOrThrow<string>('GMAIL_SMTP_USER');

    const appPassword = this.configService
      .getOrThrow<string>('GMAIL_SMTP_APP_PASSWORD')
      .replace(/\s+/g, '');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass: appPassword,
      },
    });

    return this.transporter;
  }
}

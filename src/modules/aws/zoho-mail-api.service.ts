import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

interface SendZohoEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  api_domain?: string;
  token_type: string;
}

@Injectable()
export class ZohoMailApiService {
  private readonly logger = new Logger(ZohoMailApiService.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: SendZohoEmailParams): Promise<void> {
    const accessToken = await this.getAccessToken();

    const mailApiBaseUrl = this.configService.get<string>(
      'ZOHO_MAIL_API_BASE_URL',
      'https://mail.zoho.com',
    );

    const accountId = this.configService.getOrThrow<string>('ZOHO_ACCOUNT_ID');
    const fromAddress =
      this.configService.getOrThrow<string>('ZOHO_FROM_EMAIL');

    const url = `${mailApiBaseUrl}/api/accounts/${accountId}/messages`;

    try {
      await axios.post(
        url,
        {
          fromAddress,
          toAddress: params.to,
          subject: params.subject,
          content: params.html,
          mailFormat: 'html',
          askReceipt: 'no',
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
          timeout: 15000,
        },
      );

      this.logger.log(`Zoho email sent to ${params.to}`);
    } catch (error) {
      this.handleAxiosError(error, 'Failed to send Zoho email');
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const accountsBaseUrl = this.configService.get<string>(
      'ZOHO_ACCOUNTS_BASE_URL',
      'https://accounts.zoho.com',
    );

    const refreshToken =
      this.configService.getOrThrow<string>('ZOHO_REFRESH_TOKEN');
    const clientId = this.configService.getOrThrow<string>('ZOHO_CLIENT_ID');
    const clientSecret =
      this.configService.getOrThrow<string>('ZOHO_CLIENT_SECRET');

    try {
      const response = await axios.post<ZohoTokenResponse>(
        `${accountsBaseUrl}/oauth/v2/token`,
        null,
        {
          params: {
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
          },
          timeout: 15000,
        },
      );

      this.accessToken = response.data.access_token;

      const expiresInSeconds = response.data.expires_in ?? 3600;
      this.accessTokenExpiresAt = now + (expiresInSeconds - 120) * 1000;

      return this.accessToken;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to refresh Zoho access token');
    }
  }

  private handleAxiosError(error: unknown, fallbackMessage: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logger.error(
        `${fallbackMessage}: ${axiosError.message}`,
        JSON.stringify(axiosError.response?.data ?? {}),
      );

      throw new Error(
        `${fallbackMessage}: ${axiosError.response?.status ?? 'NO_STATUS'}`,
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    this.logger.error(`${fallbackMessage}: ${message}`);

    throw new Error(fallbackMessage);
  }
}

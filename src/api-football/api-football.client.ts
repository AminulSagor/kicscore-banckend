import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

type QueryParams = Record<string, string | number | boolean | undefined>;

@Injectable()
export class ApiFootballClient {
  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = process.env.API_FOOTBALL_BASE_URL;
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!baseURL) {
      throw new Error('API_FOOTBALL_BASE_URL is missing');
    }

    if (!apiKey) {
      throw new Error('API_FOOTBALL_KEY is missing');
    }

    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'x-apisports-key': apiKey,
      },
    });
  }

  async get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const response = await this.client.get<T>(endpoint, {
      params,
    });

    return response.data;
  }
}

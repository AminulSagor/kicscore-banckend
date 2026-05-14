import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { TheNewsQueryParams } from '../types/the-news-api.type';

@Injectable()
export class TheNewsClient {
  private readonly client: AxiosInstance;
  private readonly apiToken: string;

  constructor() {
    const baseURL = process.env.THENEWS_API_BASE_URL;
    const apiToken = process.env.THENEWS_API_TOKEN;

    if (!baseURL) {
      throw new Error('THENEWS_API_BASE_URL is missing');
    }

    if (!apiToken) {
      throw new Error('THENEWS_API_TOKEN is missing');
    }

    this.apiToken = apiToken;

    this.client = axios.create({
      baseURL,
      timeout: 15000,
    });
  }

  async get<T>(endpoint: string, params?: TheNewsQueryParams): Promise<T> {
    const response = await this.client.get<T>(endpoint, {
      params: {
        ...params,
        api_token: this.apiToken,
      },
    });

    return response.data;
  }
}

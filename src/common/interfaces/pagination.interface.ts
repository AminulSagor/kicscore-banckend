import { QueryParams } from 'src/api-football/api-football-cache.service';

export interface PaginatedMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface BackendPaginationParams {
  apiParams: QueryParams;
  page: number;
  limit: number;
  shouldPaginate: boolean;
}

export type TheNewsQueryParams = Record<
  string,
  string | number | boolean | undefined
>;

export interface TheNewsApiMeta {
  found: number;
  returned: number;
  limit: number;
  page: number;
}

export interface TheNewsApiArticle {
  uuid: string;
  title: string;
  description: string | null;
  keywords: string | null;
  snippet: string | null;
  url: string;
  image_url: string | null;
  language: string | null;
  published_at: string;
  source: string | null;
  categories: string[];
  relevance_score?: number | null;
  locale?: string | null;
}

export interface TheNewsApiListResponse {
  meta: TheNewsApiMeta;
  data: TheNewsApiArticle[];
}

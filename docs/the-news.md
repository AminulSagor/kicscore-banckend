# TheNews Module (Sports)

## Overview

The TheNews module fetches sports headlines from TheNewsAPI on a schedule, stores
or updates them in Postgres, and serves all reads from the database. It never
reads from TheNewsAPI on user GET requests. Cleanup runs on a separate schedule
and deletes records older than a configurable retention window.

Key behavior:
- Hourly (default) sync to fetch `/news/top` with `categories=sports`.
- Upsert on `external_uuid` so existing articles are updated, not duplicated.
- Public GET endpoint reads from Postgres only.
- Daily cleanup (default) deletes old articles by `published_at`.

## Data Flow

1. Cron sync runs and calls TheNewsAPI.
2. The response is filtered to valid sports articles.
3. Articles are upserted into `news_articles`.
4. Public GET endpoints read only from `news_articles`.
5. Cleanup job deletes articles older than `THENEWS_RETENTION_DAYS`.

## Environment Variables

Required:
- `THENEWS_API_BASE_URL` (example: `https://api.thenewsapi.com/v1`)
- `THENEWS_API_TOKEN` (TheNewsAPI token)

Optional:
- `THENEWS_SPORTS_LIMIT` (default: `50`)
- `THENEWS_SPORTS_LANGUAGE` (default: `en`)
- `THENEWS_SYNC_CRON` (default: `0 * * * *`)
- `THENEWS_CLEANUP_CRON` (default: `0 3 * * *`)
- `THENEWS_RETENTION_DAYS` (default: `30`)
- `THENEWS_FEED_CACHE_TTL_SECONDS` (default: `900`)
- `THENEWS_FEED_CACHE_STALE_SECONDS` (default: `3600`)

Notes:
- Cron expressions are standard 5-field strings: `minute hour day month weekday`.
- Invalid or empty cron values fall back to defaults.

## Database Schema

Table: `news_articles`

Columns (core):
- `id` (uuid, PK)
- `external_uuid` (unique string from TheNewsAPI)
- `title`
- `description`
- `keywords`
- `snippet`
- `url`
- `image_url`
- `language`
- `published_at`
- `source`
- `categories` (text array)
- `locale`
- `relevance_score`
- `raw_payload` (jsonb)
- `last_fetched_at`
- `created_at`
- `updated_at`

Indexes:
- Unique index on `external_uuid`
- Index on `published_at`

## Endpoints

Base path: `/news`

### GET /news
Public endpoint. Reads from Postgres and caches the response in Redis.

Query params:
- `page` (default `1`)
- `limit` (default `20`, max `100`)

Behavior:
- Returns the latest stored sports news feed.
- Response is cached for `THENEWS_FEED_CACHE_TTL_SECONDS`.
- A stale copy is retained for `THENEWS_FEED_CACHE_STALE_SECONDS`.

### GET /news/sports
Public endpoint. Reads only from Postgres.

Query params:
- `page` (default `1`)
- `limit` (default `20`, max `100`)

Response:
```json
{
  "message": "Sports news fetched successfully",
  "data": {
    "articles": [
      {
        "id": "...",
        "uuid": "...",
        "title": "...",
        "description": "...",
        "keywords": "...",
        "snippet": "...",
        "url": "...",
        "imageUrl": "...",
        "language": "en",
        "publishedAt": "2026-05-13T00:00:00.000Z",
        "source": "...",
        "categories": ["sports"],
        "locale": "...",
        "relevanceScore": 0.82
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### GET /news/:uuid
Public endpoint. Returns one article from Postgres by external UUID.

### GET /news/:uuid/similar
Public endpoint. Returns similar articles using Postgres-based scoring.

Note: sync and cleanup run automatically via cron jobs; there are no manual
HTTP endpoints for these actions.

## Sync Logic

- Uses `/news/top` with `categories=sports`.
- Adds `api_token` as query param.
- Filters out invalid articles missing `uuid`, `title`, `url`, or `published_at`.
- Upserts by `external_uuid` and sets `last_fetched_at` on every sync.
- Persists a `mapped_entities` JSON payload for team/player/league hints.

## Mapping Logic

`NewsEntityMapperService` applies lightweight heuristics to the article title,
description, keywords, and snippet to derive candidate entities:
- `team`
- `player`
- `league`

These mapped entities are stored with each article and used to rank similar
news results.

## Feed Cache

`GET /news` caches the paginated response in Redis.
- TTL default: 15 minutes
- Stale window default: 60 minutes
- Cache key is based on page and limit

## Cleanup Logic

- Deletes records where `published_at` is older than the retention window.
- Default retention is 30 days; configurable via `THENEWS_RETENTION_DAYS`.

## Troubleshooting

- No data returned: check `THENEWS_API_TOKEN` and TheNewsAPI quotas.
- Cron not running: verify `THENEWS_SYNC_CRON` and `THENEWS_CLEANUP_CRON` values.
- Table missing: ensure TypeORM sync or migrations created `news_articles`.

## Local Testing

- Fetch results:
  - `GET /news?page=1&limit=20`
  - `GET /news/sports?page=1&limit=20`
- Fetch a detail article:
  - `GET /news/:uuid`
- Fetch similar news:
  - `GET /news/:uuid/similar`

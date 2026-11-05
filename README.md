# URL Shortener

A backend service for short links with an optional lifetime. It creates short codes (random or custom aliases), redirects visitors to the original URL through a Redis cache, and keeps click statistics in PostgreSQL. There is no frontend: the service exposes a REST API documented with Swagger.

## Stack

- Node.js 24 LTS, TypeScript (strict), NestJS 12 (ESM)
- PostgreSQL 17, Knex (migrations and seeds), Objection.js (models)
- Redis 8 via ioredis (redirect cache)
- Zod via nestjs-zod (request validation and Swagger schemas)
- @nestjs/config with a Zod-validated environment
- @nestjs/terminus (health checks)
- Jest, oxlint, Prettier
- Docker and Docker Compose

## Data model

`links`

| Field            | Type                   | Notes                                        |
| ---------------- | ---------------------- | -------------------------------------------- |
| `id`             | uuid                   | Primary key                                  |
| `code`           | varchar(32), unique    | Generated code or custom alias, case-sensitive |
| `url`            | varchar(2048)          | Original URL                                 |
| `expiresAt`      | timestamptz, nullable  | `null` means the link never expires          |
| `clicks`         | integer, default 0     | Number of successful redirects               |
| `lastAccessedAt` | timestamptz, nullable  | Time of the latest successful redirect       |
| `createdAt`      | timestamptz            |                                              |
| `updatedAt`      | timestamptz            |                                              |

Columns are stored in `snake_case` and mapped to `camelCase` by Objection.

## Business rules

- `url` must be a valid `http` or `https` URL of at most 2048 characters.
- `alias` is optional: 3–32 characters from `[A-Za-z0-9_-]`. A taken alias returns `409`, a reserved one (`api`, `docs`, `health`, `links` and a few others, case-insensitive) returns `400`.
- Without an alias, a random 7-character base62 code is generated; on a collision the service retries with a new code.
- `ttlSeconds` is optional: an integer from 60 to 31536000 (one year). Without it the link is permanent.
- Unknown codes return `404`. Expired links return `410 Gone` on redirect, while `GET /api/links/:code` still returns them with `isExpired: true`.
- Every successful redirect atomically runs `UPDATE ... SET clicks = clicks + 1` and updates `lastAccessedAt`.
- Request bodies are strict: unknown fields, `null` values and wrong types are rejected with `400`.

## API

Swagger UI is available at [`/docs`](http://localhost:3100/docs), the OpenAPI document at `/docs-json`.

| Method   | Path               | Description                                                       |
| -------- | ------------------ | ----------------------------------------------------------------- |
| `POST`   | `/api/links`       | Create a link from `{ url, alias?, ttlSeconds? }`, returns `201`   |
| `GET`    | `/api/links`       | List links, newest first: `?page=1&limit=20` (limit up to 100)    |
| `GET`    | `/api/links/:code` | Link details and statistics                                       |
| `DELETE` | `/api/links/:code` | Delete a link and evict it from the cache, returns `204`          |
| `GET`    | `/api/health`      | PostgreSQL and Redis connectivity                                 |
| `GET`    | `/:code`           | `302` redirect to the original URL                                |

Example:

```bash
curl -X POST http://localhost:3100/api/links \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://docs.nestjs.com", "alias": "nest-docs", "ttlSeconds": 3600}'
```

```json
{
  "id": "0b5c7a52-4f1e-4a0f-9c43-7d1f3e0c2a11",
  "code": "nest-docs",
  "url": "https://docs.nestjs.com",
  "shortUrl": "http://localhost:3100/nest-docs",
  "expiresAt": "2026-11-05T13:00:00.000Z",
  "isExpired": false,
  "clicks": 0,
  "lastAccessedAt": null,
  "createdAt": "2026-11-05T12:00:00.000Z",
  "updatedAt": "2026-11-05T12:00:00.000Z"
}
```

The list endpoint responds with `{ items, total, page, limit }`.

### Errors

Every error uses the same format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["ttlSeconds: Too small: expected number to be >=60"],
  "path": "/api/links",
  "timestamp": "2026-11-05T12:00:00.000Z"
}
```

Validation errors list every message. Database unique violations map to `409` and Objection `NotFoundError` to `404`. Any unexpected error becomes `500` with a generic message, and the details are only written to the log.

## Redirect cache

1. `GET /:code` reads `link:<code>` from Redis. The cached value holds the URL and the expiration time.
2. On a cache hit, the expiration time is checked first. An expired link returns `410` and its key is removed, so an expired link never redirects even from the cache.
3. On a miss, the link is loaded from PostgreSQL and stored in Redis with a TTL equal to the remaining lifetime of the link. Permanent links use a fixed TTL (`REDIRECT_CACHE_TTL_SECONDS`, 24 hours by default), and expiring links never stay cached longer than that.
4. The click counter is incremented in PostgreSQL on every redirect. If the row no longer exists, the stale key is evicted and the request returns `404`.
5. `DELETE /api/links/:code` removes the row and the Redis key.

If Redis is unavailable, the service fails fast and serves redirects straight from PostgreSQL; `/api/health` reports the outage with `503`.

## Configuration

| Variable                     | Default       | Description                                   |
| ---------------------------- | ------------- | --------------------------------------------- |
| `NODE_ENV`                   | `development` | `development`, `production` or `test`         |
| `PORT`                       | `3000`        | HTTP port                                     |
| `BASE_URL`                   | —             | Public base URL used to build `shortUrl`      |
| `DATABASE_URL`               | —             | PostgreSQL connection string                  |
| `REDIS_URL`                  | —             | Redis connection string                       |
| `REDIRECT_CACHE_TTL_SECONDS` | `86400`       | Maximum cache TTL, used as is for permanent links |

The environment is validated with Zod at startup, and the application refuses to start with an invalid configuration.

## Running with Docker Compose

```bash
docker compose up -d --build
```

The stack contains PostgreSQL, Redis, a one-off `migrate` service that applies migrations and seeds the database, and the application, which starts once migrations have finished.

- API: http://localhost:3100/api
- Swagger: http://localhost:3100/docs
- PostgreSQL: `localhost:5434`, Redis: `localhost:6380`

The seed creates a few sample links: permanent ones (`nestjs`, `Xk7pQ2m`), expiring ones (`knex-guide`, `r9TbW4z`) and an already expired one (`black-friday`).

To start from a clean database:

```bash
docker compose down -v
docker compose up -d --build
```

## Running locally

Requirements: Node.js 22.12+ (24 LTS recommended), PostgreSQL and Redis. The compose file can provide the latter two:

```bash
docker compose up -d postgres redis
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run start:dev
```

Other database commands: `npm run db:rollback` reverts the latest migration batch. Migrations and seeds live in `src/database/migrations` and `src/database/seeds`.

## Tests and code quality

```bash
npm test          # unit tests
npm run test:cov  # unit tests with coverage
npm run lint      # oxlint with type-aware rules
npm run typecheck # tsc --noEmit
npm run format    # Prettier
npm run build     # production build
```

Unit tests cover the link, redirect and cache services and the exception filter, with Objection, Knex and Redis mocked.

## Project structure

```
src/
  common/      exception filter, validation pipe, shared DTOs
  config/      environment schema and config module
  database/    Knex config, migrations, seeds, Objection models, CLI
  redis/       Redis client module
  links/       link CRUD, DTOs and the redirect cache service
  redirect/    GET /:code redirect
  health/      PostgreSQL and Redis health checks
```

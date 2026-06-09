# nestjs-profiler

<p align="center">
  <img src="https://raw.githubusercontent.com/MohammedRaslan/Nest-JS-Profiler/refs/heads/main/libs/nestjs-profiler/src/assets/logo.png" width="400" alt="NestJS Profiler Logo" />
</p>

A NestJS module for profiling HTTP requests, database queries, cache operations, outbound HTTP calls, and application logs. Inspired by Symfony Profiler, it provides a web-based dashboard to inspect everything that happens inside a request — from DB queries to downstream API calls — in real time.

## Features

- **HTTP Request Tracing** — Tracks method, URL, controller handler, duration, status code, headers, and request body.
- **Database Profiling**
  - **PostgreSQL** — Captures all queries via `pg` (compatible with TypeORM, MikroORM, raw pg). Supports **Auto-Explain** to run `EXPLAIN` or `EXPLAIN ANALYZE` on slow queries automatically.
  - **MongoDB** — Profiles MongoDB commands and queries.
  - **MySQL** — Profiles MySQL queries.
  - **N+1 Detection** — Automatically flags repeated identical queries within the same request.
  - **Slow Query Tagging** — Tags queries exceeding 100ms.
  - **Sequential Scan Detection** — Tags queries using a Seq Scan from the explain plan.
- **Outbound HTTP Tracking** — Captures every outbound `http`/`https` call made during a request: URL, method, status code, duration, and headers. Works automatically with axios, node-fetch, and any library built on Node's `http`/`https` modules. Enabled by default — no configuration required.
- **Cache Profiling** — Tracks cache operations (get, set, del, reset) and hit/miss ratio when using `@nestjs/cache-manager`.
- **Log Profiling** — Captures application logs associated with each request context.
- **Live Logs Terminal** — Real-time streaming log viewer at `/__profiler/view/logs/live` via Server-Sent Events. Supports level filtering, search, pause/resume, and auto-scroll.
- **Summary Dashboard** — Aggregate statistics: avg/p95 duration, error rate, cache hit rate, top slow endpoints, top slow queries, and recent errors.
- **Entity Explorer** — Lists all registered TypeORM/MikroORM entities and their columns.
- **Route Explorer** — Lists all registered routes with their controllers and handlers.
- **Web UI** — Built-in dashboard at `/__profiler` with no external dependencies.
- **Zero Hard Dependencies** — Core functionality works out of the box; database drivers are optional peer dependencies.

## Installation

```bash
npm install nestjs-profiler
```

### Peer Dependencies (Optional)

Install only the dependencies relevant to your project:

```bash
# For PostgreSQL
npm install pg

# For MongoDB
npm install mongodb

# For MySQL
npm install mysql2

# For Cache Profiling
npm install @nestjs/cache-manager cache-manager
```

## Configuration

Import `ProfilerModule` in your root `AppModule`:

```typescript
import { Module } from '@nestjs/common';
import { ProfilerModule } from 'nestjs-profiler';
import * as pg from 'pg';

@Module({
  imports: [
    ProfilerModule.forRoot({
      // Global enable/disable (default: true)
      // Recommended: disable in production
      enabled: process.env.NODE_ENV !== 'production',

      // ── Database ─────────────────────────────────────────────────
      // PostgreSQL — pass the pg driver instance
      pgDriver: pg,
      collectQueries: true,

      // Auto-Explain for slow queries
      explain: {
        enabled: true,
        thresholdMs: 50,   // Only explain queries taking > 50ms
        analyze: false,    // true = EXPLAIN ANALYZE (actually executes!)
      },

      // MongoDB — pass the mongodb driver instance
      mongoDriver: require('mongodb'),
      collectMongo: true,

      // MySQL — pass the mysql2 driver instance
      mysqlDriver: require('mysql2'),
      collectMysql: true,

      // ── Outbound HTTP ─────────────────────────────────────────────
      // Tracks all outbound http/https calls made during each request.
      // Enabled by default — set false to disable.
      collectHttp: true,

      // ── Cache ─────────────────────────────────────────────────────
      collectCache: true,   // requires @nestjs/cache-manager

      // ── Logs ──────────────────────────────────────────────────────
      collectLogs: true,

      // ── Storage ───────────────────────────────────────────────────
      // Default: in-memory (last 100 requests).
      // Pass a custom object implementing ProfilerStorage for persistence.
      storage: 'memory',
    }),
  ],
})
export class AppModule {}
```

### Default behaviour

| Option | Default | Notes |
|---|---|---|
| `enabled` | `true` | Set `false` or tie to `NODE_ENV` |
| `collectHttp` | `true` | Patches `http`/`https` automatically |
| `collectLogs` | `true` | |
| `collectQueries` | `true` | Requires `pgDriver` / `mongoDriver` / `mysqlDriver` |
| `collectCache` | `true` | Requires `@nestjs/cache-manager` |
| `explain.enabled` | `false` | Opt-in only |

## Usage

### 1. Initialize Explorers (Optional but Recommended)

To enable the **Entity Explorer** and **Route Explorer**, call `initialize` in `main.ts` after creating the app:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProfilerModule } from 'nestjs-profiler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  ProfilerModule.initialize(app);

  await app.listen(3000);
}
bootstrap();
```

### 2. Accessing the Dashboard

Once configured, start your application. The profiler automatically intercepts all requests.

Navigate to `http://localhost:3000/__profiler`.

#### Dashboard Pages

| Path | Description |
|---|---|
| `/__profiler` | Request list — all captured requests |
| `/__profiler/view/summary` | Aggregate stats: avg/p95 duration, error rate, top slow endpoints |
| `/__profiler/view/queries` | All database queries across requests, sorted by duration |
| `/__profiler/view/http-calls` | All outbound HTTP calls across requests, sorted by duration |
| `/__profiler/view/logs` | Paginated application logs |
| `/__profiler/view/logs/live` | Live streaming terminal — real-time log output |
| `/__profiler/view/cache` | Cache operations with hit/miss breakdown |
| `/__profiler/view/entities` | Registered database entities |
| `/__profiler/view/routes` | All registered application routes |
| `/__profiler/:id` | Full detail view for a single request |

### 3. Outbound HTTP Tracking

Outbound HTTP tracking is **enabled by default**. Any `http.request`, `https.request`, `http.get`, or `https.get` call made during a request is automatically captured — including calls made via axios, node-fetch, and similar libraries.

Each captured call records:

- Method and full URL
- HTTP vs HTTPS protocol
- Response status code
- Duration in ms
- Request and response headers (Authorization/Cookie values are automatically redacted)
- Error message if the call failed

You can view outbound calls for a specific request in the request detail view, or browse all calls across all requests at `/__profiler/view/http-calls`.

To disable:

```typescript
ProfilerModule.forRoot({ collectHttp: false })
```

### 4. JSON API

Retrieve profile data programmatically:

- `GET /__profiler/json` — List all captured requests
- `GET /__profiler/:id/json` — Details for a specific request

## Global Prefix

If your app uses a global prefix (e.g. `/api`), exclude the profiler routes:

```typescript
app.setGlobalPrefix('api', {
  exclude: [{ path: '__profiler/(.*)', method: RequestMethod.ALL }],
});
```

## Important Notes

- The profiler is designed for **development and debugging only**. Do not enable in production — it adds request overhead and exposes internal application data.
- The default in-memory storage holds the last 100 requests. Older profiles are evicted automatically.
- Outbound HTTP tracking patches `http`/`https` at the Node.js module level. The patch is applied once on module init and is safe for hot-reload (double-patch is guarded).

## License

MIT

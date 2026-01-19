# @nestjs-pg-profiler

A NestJS module for profiling HTTP requests and PostgreSQL queries. Inspired by Symfony Profiler, it provides a web-based dashboard to inspect request duration, executed queries, and EXPLAIN plans for slow queries.

## Features

-   **HTTP Request Tracing**: Tracks method, URL, controller handler, duration, and status code.
-   **PostgreSQL Query Profiling**: Captures all queries executed via `pg` (compatible with TypeORM, MikroORM, raw pg, etc.).
-   **Auto-Explain**: Automatically runs `EXPLAIN` or `EXPLAIN ANALYZE` on queries slower than a configurable threshold.
-   **Web UI**: Built-in lightweight dashboard at `/__profiler` to view traces.
-   **Zero Dependencies**: (Runtime) Only requires `pg` and `@nestjs/common`.

## Installation

```bash
npm install @nestjs-pg-profiler/core
# or if running from source in this monorepo
npm install
```

## Configuration

Import `ProfilerModule` in your root `AppModule`.

```typescript
import { Module } from '@nestjs/common';
import { ProfilerModule } from '@nestjs-pg-profiler/core';

@Module({
  imports: [
    ProfilerModule.forRoot({
      // Global enable/disable
      enabled: process.env.NODE_ENV !== 'production', 
      
      // Capture PostgreSQL queries
      collectQueries: true,
      
      // Auto-Explain configuration
      explain: {
        enabled: true,
        thresholdMs: 50,  // Only explain queries taking > 50ms
        analyze: false,   // If true, runs EXPLAIN ANALYZE (execution!)
      },
      
      // Storage backend (default: InMemory)
      storage: 'memory', 
    }),
  ],
})
export class AppModule {}
```

## Usage

Once configured, simply start your application. The profiler automatically intercepts requests and database queries.

### Accessing the Dashboard

Navigate to `http://localhost:3000/__profiler` (or your app's port).

### JSON API

You can also retrieve profile data programmatically:
-   `GET /__profiler/json` - List recent requests
-   `GET /__profiler/:id/json` - Get details for a specific request

## License

MIT

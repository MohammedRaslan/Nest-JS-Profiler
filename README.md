# nestjs-profiler

A NestJS module for profiling HTTP requests, database queries, and cache operations. Inspired by Symfony Profiler, it provides a web-based dashboard to inspect request duration, executed queries, log messages, and explain plans for slow queries.

## Features

-   **HTTP Request Tracing**: Tracks method, URL, controller handler, duration, and status code.
-   **Database Profiling**:
    -   **PostgreSQL**: Captures queries executed via `pg` (compatible with TypeORM, MikroORM, raw pg). Supports **Auto-Explain** to running `EXPLAIN` or `EXPLAIN ANALYZE` on slow queries.
    -   **MongoDB**: Profiles MongoDB commands and queries.
    -   **MySQL**: Profiles MySQL queries.
-   **Cache Profiling**: Tracks cache operations (get, set, del) when using `@nestjs/cache-manager`.
-   **Logger Profiling**: Captures application logs associated with the request context.
-   **Web UI**: Built-in lightweight dashboard at `/__profiler` to view traces.
-   **Zero Hard Dependencies**: Core functionality works out of the box; database drivers are optional peer dependencies.

## Installation

```bash
npm install nestjs-profiler
```

### Peer Dependencies (Optional)

Install the dependencies relevant to your project:

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

Import `ProfilerModule` in your root `AppModule`.

```typescript
import { Module } from '@nestjs/common';
import { ProfilerModule } from 'nestjs-profiler';

@Module({
  imports: [
    ProfilerModule.forRoot({
      // Global enable/disable (default: true)
      enabled: process.env.NODE_ENV !== 'production',

      // PostgreSQL Profiling
      collectQueries: true,
      explain: {
        enabled: true,
        thresholdMs: 50,  // Only explain queries taking > 50ms
        analyze: false,   // If true, runs EXPLAIN ANALYZE (execution!)
      },
      // Add pgDriver
      pgDriver: pg,
      
      // MongoDB Profiling (default: true)
      collectMongo: true,
      
      // MySQL Profiling (default: true)
      collectMysql: true,
      
      // Cache Profiling (default: true)
      collectCache: true,
      
      // Log Profiling (default: true)
      collectLogs: true,

      // Storage backend (default: InMemory)
      // You can implement custom storage by passing an object implementing ProfilerStorage
      storage: 'memory', 
    }),
  ],
})
export class AppModule {}
```

## Usage

### 1. Initialize Explorers (Optional but Recommended)

To enable the **Entity Explorer** and **Route Explorer** features in the dashboard, initialize the profiler in your `main.ts` file right after creating the application.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProfilerModule } from 'nestjs-profiler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Initialize Profiler Explorers
  ProfilerModule.initialize(app);
  
  await app.listen(3000);
}
bootstrap();
```

### 2. Accessing the Dashboard

Once configured, start your application. The profiler automatically intercepts requests and queries.

Navigate to `http://localhost:3000/__profiler` (or your app's port).

### 3. JSON API

You can also retrieve profile data programmatically:
-   `GET /__profiler/json` - List recent requests
-   `GET /__profiler/:id/json` - Get details for a specific request

## License

MIT

# nestjs-profiler

<p align="center">
  <img src="https://raw.githubusercontent.com/MohammedRaslan/Nest-JS-Profiler/refs/heads/main/libs/nestjs-profiler/src/assets/logo.png" width="400" alt="NestJS Profiler Logo" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nestjs-profiler"><img src="https://img.shields.io/npm/v/nestjs-profiler.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/nestjs-profiler"><img src="https://img.shields.io/npm/dm/nestjs-profiler.svg" alt="npm downloads" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D16-brightgreen" alt="node version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license" />
</p>

> A drop-in debugging dashboard for NestJS. Inspect HTTP requests, database queries, outbound calls, logs, events, scheduled jobs, memory usage, and code health — all from one browser tab, with zero instrumentation required.

---

> ⚠️ **Development use only.** The profiler adds request overhead and exposes internal application data. Always set `enabled: process.env.NODE_ENV !== 'production'`.

---

## Quick Start

**1. Install**

```bash
npm install nestjs-profiler
```

**2. Register in your AppModule**

```typescript
import { ProfilerModule } from 'nestjs-profiler';

@Module({
  imports: [
    ProfilerModule.forRoot({
      enabled: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

**3. Initialize in main.ts**

```typescript
import { ProfilerModule } from 'nestjs-profiler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  ProfilerModule.initialize(app); // enables Route Explorer, Entity Explorer, Scheduled Jobs
  await app.listen(3000);
}
```

---

### Global Prefix (Required if you use global route prefix)

If your app uses a global route prefix, exclude the profiler:

```typescript
app.setGlobalPrefix('api', {
  exclude: [{ path: '__profiler/(.*)', method: RequestMethod.ALL }],
});
```

Open `http://localhost:3000/__profiler` — the dashboard is live.

---

## Features

### Request Profiling
- Traces every HTTP request: method, URL, handler, status code, duration, headers, and body
- Summary dashboard with avg/p95 duration, error rate, cache hit rate, top slow endpoints, and recent errors
- Full detail view per request including all associated queries, cache ops, logs, and outbound calls

### Database
- **PostgreSQL** — captures all queries via `pg`, compatible with TypeORM, MikroORM, and raw pg
- **MongoDB** — profiles all MongoDB commands
- **MySQL** — profiles MySQL queries via `mysql2`
- **N+1 Detection** — flags repeated identical queries within the same request
- **Slow Query Tagging** — highlights queries over 100ms
- **Sequential Scan Detection** — flags full table scans from the query explain plan
- **Auto-Explain** — automatically runs `EXPLAIN` or `EXPLAIN ANALYZE` on slow queries (opt-in)

### Outbound HTTP
Automatically captures every `http`/`https` call your app makes — including axios, node-fetch, and any library built on Node's core modules. Records method, URL, status code, duration, headers (with Authorization and Cookie values redacted), and errors. No configuration required.

### Cache
Tracks `get`, `set`, `del`, and `reset` operations with hit/miss ratio when using `@nestjs/cache-manager`.

### Logs
- Captures application logs per request context
- **Live Logs Terminal** — real-time streaming viewer via Server-Sent Events, with level filtering, search, pause/resume, and auto-scroll

### Code Analysis
- **Package Health** — runs `npm audit` and `npm outdated` to surface vulnerabilities and stale dependencies, sorted by severity
- **Code Quality** — runs ESLint and `tsc --noEmit` against your source. Issues shown by file or by rule, with links to rule docs and TypeScript error references. Auto-fixable issues are flagged

### Application Intelligence
- **Route Explorer** — every registered route grouped by controller, with path/query/header params, body DTOs, property types, and source file paths
- **Entity Explorer** — all registered TypeORM/MikroORM entities with their columns
- **Event Tracking** — intercepts every `EventEmitter2` emission and renders a cascading tree: which service fired it, which listeners handled it, individual timings, child events, and errors. Requires `@nestjs/event-emitter`
- **Scheduled Jobs** — live view of all `@Cron`, `@Interval`, and `@Timeout` jobs from `@nestjs/schedule`, with countdowns, last run times, cycle progress, and handler details. Requires `@nestjs/schedule`

### Memory Monitor
Continuously samples Node.js heap statistics using `process.memoryUsage()` and `v8.getHeapStatistics()` (zero extra dependencies). Stores a 60-sample rolling window (10 minutes at 10-second intervals) and computes a 0–100 leak score from three signals: heap growth rate across the window, number of V8 detached contexts, and sustained growth ratio. Trend is classified as `stable`, `growing`, or `likely_leak`.

- **Live heap chart** — SVG line chart of `heapUsed` across the rolling window, auto-refreshes every 15 seconds
- **Stat cards** — heap used, heap total, RSS, detached contexts, and heap size limit
- **Leak score ring** — 0–100 circular gauge with score breakdown by component
- **Per-request memory delta** — every intercepted request records `heapUsed` before and after the handler; the top 20 highest-delta requests are shown in a table
- **Force GC** — manually triggers garbage collection (requires `--expose-gc`, pre-wired in `start:dev`)
- **Heap Snapshot** — generates a V8 heap snapshot and streams it directly to the browser as a `.heapsnapshot` download; open in Chrome DevTools → Memory tab → Load for a full object-level leak analysis

**Leak score breakdown:**

| Component | Max pts | Signal |
|---|---|---|
| Growth rate | 40 | `(avg second half − avg first half) / avg first half` of rolling window |
| Detached contexts | 40 | `numberOfDetachedContexts × 8` from V8 GC metadata |
| Sustained growth | 20 | Fraction of 10s intervals where heap grew (>70% = full 20 pts) |

Score < 30 → `stable` · 30–59 or growth ≥ 5% → `growing` · ≥ 60 or growth ≥ 15% → `likely_leak`

**Enabling GC and snapshots in development:**

The `start:dev`, `start:debug`, and `start:prod` scripts all pass `--expose-gc` automatically. If you run Node directly:

```bash
node --expose-gc dist/main
```

### Security
- **Dashboard Authentication** — optional login wall with HMAC-SHA256 tokens stored in `localStorage`, 24-hour TTL. No separate auth server needed

---

## Installation

```bash
npm install nestjs-profiler
```

### Optional Peer Dependencies

Install only what your project uses:

```bash
npm install pg                              # PostgreSQL
npm install mongodb                         # MongoDB
npm install mysql2                          # MySQL
npm install @nestjs/cache-manager cache-manager   # Cache profiling
npm install @nestjs/event-emitter           # Event tracking
npm install @nestjs/schedule                # Scheduled jobs
```

---

## Configuration

All options are passed to `ProfilerModule.forRoot()`. Only `enabled` is required — everything else is opt-in.

```typescript
import { ProfilerModule } from 'nestjs-profiler';
import * as pg from 'pg';

@Module({
  imports: [
    ProfilerModule.forRoot({
      enabled: process.env.NODE_ENV !== 'production',

      // PostgreSQL
      pgDriver: pg,
      collectQueries: true,
      explain: {
        enabled: true,
        thresholdMs: 100,  // explain queries slower than this
        analyze: false,    // true = EXPLAIN ANALYZE (executes the query!)
      },

      // MongoDB
      mongoDriver: require('mongodb'),
      collectMongo: true,

      // MySQL
      mysqlDriver: require('mysql2'),
      collectMysql: true,

      // Outbound HTTP (on by default)
      collectHttp: true,

      // Cache
      collectCache: true,

      // Logs
      collectLogs: true,

      // Auth (off by default)
      auth: {
        enabled: true,
        username: 'admin',
        password: 'supersecret',
      },
    }),
  ],
})
export class AppModule {}
```

### Options Reference

| Option | Default | Description |
|---|---|---|
| `enabled` | `true` | Master switch. Tie to `NODE_ENV` in production |
| `collectHttp` | `true` | Outbound HTTP tracking (patches `http`/`https`) |
| `collectLogs` | `true` | Log capture per request |
| `collectQueries` | `true` | DB query capture. Requires a driver to be passed |
| `collectCache` | `true` | Cache op tracking. Requires `@nestjs/cache-manager` |
| `explain.enabled` | `false` | Auto-Explain for slow queries |
| `explain.thresholdMs` | `100` | Minimum query duration to trigger explain |
| `explain.analyze` | `false` | Run `EXPLAIN ANALYZE` instead of `EXPLAIN` |
| `auth.enabled` | `false` | Enable login wall. `username` and `password` required when `true` |
| Event Tracking | automatic | Activates when `@nestjs/event-emitter` is detected |
| Scheduled Jobs | automatic | Activates when `@nestjs/schedule` is detected |

---

## Dashboard

Navigate to `/__profiler` after starting your app.

| Page | Description |
|---|---|
| `/__profiler/view/summary` | Aggregate stats: avg/p95 duration, error rate, top slow endpoints |
| `/__profiler/view/requests` | All captured requests with status, duration, and method |
| `/__profiler/view/queries` | All DB queries across requests, sortable by duration |
| `/__profiler/view/http-calls` | All outbound HTTP calls, sortable by duration |
| `/__profiler/view/logs` | Paginated application logs |
| `/__profiler/view/logs/live` | Real-time streaming log terminal |
| `/__profiler/view/cache` | Cache operations with hit/miss breakdown |
| `/__profiler/view/entities` | Registered database entities and their columns |
| `/__profiler/view/routes` | All registered routes with DTOs and parameter types |
| `/__profiler/view/health` | Package vulnerabilities and outdated dependency report |
| `/__profiler/view/code-quality` | ESLint and TypeScript static analysis |
| `/__profiler/view/events` | Event cascade tree for `EventEmitter2` emissions |
| `/__profiler/view/cron-jobs` | Live scheduled job monitor — cron, intervals, and timeouts |
| `/__profiler/view/memory` | Heap monitor — live chart, leak score, per-request memory deltas, GC and snapshot controls |
| `/__profiler/:id` | Full detail view for a single request |

### JSON API

All data is also available as JSON for programmatic use:

```
GET /__profiler/json                  # all captured requests
GET /__profiler/:id/json              # single request detail
GET /__profiler/api/health            # package health (5 min cache)
GET /__profiler/api/health?force=true
GET /__profiler/api/code-quality      # static analysis (5 min cache)
GET /__profiler/api/code-quality?force=true
GET /__profiler/api/events            # event log (live, not cached)
GET /__profiler/api/cron-jobs         # scheduled job state (live, not cached)
GET /__profiler/api/memory            # current heap report + leak score + top request deltas
POST /__profiler/api/memory/gc        # force GC (requires --expose-gc)
POST /__profiler/api/memory/snapshot  # generate and download a .heapsnapshot file
```

---

## Feature Guides

### Dashboard Authentication

```typescript
ProfilerModule.forRoot({
  auth: {
    enabled: true,
    username: 'admin',
    password: 'supersecret',
  },
})
```

When enabled, all `/__profiler` pages check for a valid token in `localStorage` before rendering. If none is found, the browser redirects to the login page. Tokens use HMAC-SHA256 keyed on the password and expire after 24 hours — changing the password invalidates all active sessions automatically.

TypeScript enforces that `username` and `password` are present when `enabled: true`. Omitting either is a compile-time error.

> Auth is enforced client-side. It prevents casual access on shared dev/staging environments but is not a security boundary for sensitive data.

| Route | Purpose |
|---|---|
| `GET /__profiler/login` | Login page |
| `POST /__profiler/api/login` | Validates credentials, returns a session token |
| `GET /__profiler/logout` | Clears the token and redirects to login |

---

### Event Tracking

Requires `@nestjs/event-emitter`:

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
})
export class AppModule {}
```

The profiler intercepts every `emit` and `emitAsync` call automatically. No decorators or instrumentation needed. The dashboard renders a full cascade tree showing the emitter, all listeners with timings, child events, and any listener errors.

**Example — what you see in the dashboard:**

```
🔔 order.created  (async)  ⬆ OrderService.createOrder  145ms
  ✓ onOrderCreated [InventoryListener]   45ms
  ✓ onOrderCreated [InvoiceListener]     80ms
  ✓ onOrderCreated [AuditListener]        5ms
    └── 🔔 inventory.reserved  ⬆ InventoryListener  23ms
          ✓ onInventoryReserved [NotificationListener]  20ms
    └── 🔔 invoice.created  ⬆ InvoiceListener  4ms
          ✓ onInvoiceCreated [AuditListener]   3ms
```

---

### Scheduled Jobs

Requires `@nestjs/schedule`:

```bash
npm install @nestjs/schedule
```

```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
})
export class AppModule {}
```

The profiler detects `SchedulerRegistry` at startup via `ProfilerModule.initialize(app)` — no additional configuration needed. The dashboard has three tabs:

**Cron Jobs** — one card per `@Cron()` method showing the expression with a plain-English translation (e.g. `0 */5 * * * *` → *Every 5 minutes*), a live next-run countdown, last run time, cycle progress bar, handler name, and source file path. An *Upcoming — next 3 hours* strip at the top plots all jobs on a shared timeline.

**Intervals** — one card per `@Interval()` method with an animated frequency ring, the repeat period displayed prominently (e.g. *Every 30s*), and fires-per-minute count.

**Timeouts** — one card per `@Timeout()` method. Pending jobs show a live countdown in amber; fired jobs turn grey with a *Fired* badge. Both show the configured delay and the handler that will run.

All tabs auto-refresh every 15 seconds. If `@nestjs/schedule` is not installed, the page shows an install prompt instead of an error.

**Example:**

```typescript
import { Cron, CronExpression, Interval, Timeout } from '@nestjs/schedule';

@Injectable()
export class TasksService {

  @Cron(CronExpression.EVERY_MINUTE, { name: 'health-ping' })
  handleHealthPing() { /* ... */ }

  @Cron('0 0 * * *', { name: 'nightly-cleanup' })
  handleNightlyCleanup() { /* ... */ }

  @Interval('metrics-flush', 30_000)
  handleMetricsFlush() { /* ... */ }

  @Timeout('deferred-init', 10_000)
  handleDeferredInit() { /* ... */ }
}
```

---

### Memory Monitor

No configuration needed — the Memory Monitor starts automatically when the profiler is enabled. It polls every 10 seconds and becomes meaningful after roughly 2 minutes of uptime (20 samples).

Navigate to `/__profiler/view/memory` to see the live dashboard.

**Force GC** triggers `global.gc()` if Node was started with `--expose-gc`. The `start:dev`, `start:debug`, and `start:prod` scripts in this package include the flag automatically. If you manage your own start command:

```bash
node --expose-gc dist/main
```

**Heap Snapshot** generates a V8 heap snapshot on the server, streams it directly to your browser as a file download, and deletes the temp file. To analyse it:

1. Open Chrome DevTools
2. Go to the **Memory** tab
3. Click the **Load** icon (folder button at the top)
4. Select the downloaded `.heapsnapshot` file

The snapshot shows every object in the heap — retained size, shallow size, constructor name, distance from GC root — searchable and filterable. Useful for identifying *what* is leaking after the Memory Monitor tells you *that* something is leaking.

**Reading the leak score:**

Trigger a few demo patterns (if you have the demo module enabled) and watch the score climb in real time:

```
POST /demo/memory/leak/array      # unbounded array — grows heapUsed
POST /demo/memory/leak/listeners  # orphaned listeners — raises detached contexts
POST /demo/memory/leak/cache      # unbounded Map — slow steady growth
DELETE /demo/memory/leak/all      # clear everything
```

---

### Route Explorer

Populated by `ProfilerModule.initialize(app)`. Lists every route grouped by controller in an expandable accordion. Each route surfaces:

- HTTP method and full path (including global prefix)
- Path parameters, query parameters, and headers with their TypeScript types
- Body DTO — class name, all decorated properties and types (discovered via `reflect-metadata`)
- Source file path with a one-click copy button

Works with `emitDecoratorMetadata: true` (standard in NestJS). No OpenAPI/Swagger required.

## License

MIT

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  Req,
  Inject,
  Optional,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ProfilerService } from '../services/profiler.service';
import { ViewService } from '../services/view.service';
import { TemplateBuilderService } from '../services/template-builder.service';
import { EntityExplorerService } from '../services/entity-explorer.service';
import { RouteExplorerService } from '../services/route-explorer.service';
import { HealthService } from '../services/health.service';
import { CodeQualityService } from '../services/code-quality.service';
import { CronExplorerService } from '../services/cron-explorer.service';
import { ProfilerOptions } from '../common/profiler-options.interface';
import { createHmac } from 'crypto';

@Controller('__profiler')
export class ProfilerController {
  constructor(
    private readonly profilerService: ProfilerService,
    private readonly viewService: ViewService,
    private readonly templateBuilder: TemplateBuilderService,
    private readonly entityExplorer: EntityExplorerService,
    private readonly routeExplorer: RouteExplorerService,
    private readonly healthService: HealthService,
    private readonly codeQualityService: CodeQualityService,
    private readonly cronExplorer: CronExplorerService,
    @Optional() @Inject('PROFILER_OPTIONS') private readonly profilerOptions: ProfilerOptions,
  ) {}

  private get authEnabled(): boolean {
    return this.profilerOptions?.auth?.enabled === true;
  }

  private renderLayout(title: string, content: string, activeTab?: string): string {
    return this.viewService.renderWithLayout(title, content, activeTab, this.authEnabled);
  }

  @Get()
  async dashboard(@Res() res: Response) {
    res.redirect('/__profiler/view/summary');
  }

  @Get('view/requests')
  async requestsList(@Res() res: Response) {
    const profiles = await this.profilerService.getDashboardData();
    const content = this.templateBuilder.buildDashboard(profiles);
    const html = this.renderLayout(
      'Requests',
      content,
      'requests',
    );
    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('json')
  async listJson() {
    return this.profilerService.getAllProfilesJson();
  }

  @Get('debug/test-query')
  async debugQuery() {
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'postgres',
    });
    try {
      await client.connect();
      await client.query('SELECT 1 as test_query');
      await client.end();
      return { status: 'success', message: 'Query executed. Check profiler.' };
    } catch (e: any) {
      return {
        status: 'error',
        message: `Connection failed: ${e.message}`,
        tip: 'Pass correct credentials in URL: ?user=YOUR_USER&password=YOUR_PASS&database=YOUR_DB',
      };
    }
  }

  // ─── Auth routes ─────────────────────────────────────────────────────────

  @Get('login')
  async loginPage(
    @Res() res: Response,
    @Query('returnTo') returnTo?: string,
  ) {
    const html = this.viewService.render('login', {
      returnTo: returnTo || '/__profiler',
    });
    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  /** JSON API — called by the login page via fetch(). Returns token on success. */
  @Post('api/login')
  async apiLogin(
    @Res() res: Response,
    @Body() body: { username?: string; password?: string },
  ) {
    const auth = this.profilerOptions?.auth;

    // Auth disabled — return a pass-through token so the client can proceed
    if (!auth || auth.enabled === false) {
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      res.json({ token: 'no-auth', expiresAt });
      return;
    }

    const { username = '', password = '' } = body;

    if (username === auth.username && password === auth.password) {
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const token = createHmac('sha256', auth.password)
        .update(`${auth.username}:${expiresAt}`)
        .digest('hex');
      res.json({ token, expiresAt, username: auth.username });
    } else {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid username or password.' });
    }
  }

  /** Clears the localStorage token client-side and redirects to login. */
  @Get('logout')
  async logout(@Res() res: Response) {
    const html = `<!DOCTYPE html><html><head><title>Signing out…</title>
<script>try{localStorage.removeItem('__profiler_auth');}catch(e){}window.location.replace('/__profiler/login');</script>
</head><body></body></html>`;
    res.header('Content-Type', 'text/html').send(html);
  }

  // ─── Profile detail (must stay after all static routes) ──────────────────

  @Get(':id')
  async detail(@Param('id') id: string, @Res() res: Response) {
    const profile = await this.profilerService.getProfileDetail(id);

    if (!profile) {
      const content = this.templateBuilder.buildNotFound(id);
      const html = this.renderLayout(
        'Profile Not Found',
        content,
      );
      res.header('Content-Type', 'text/html');
      res.status(HttpStatus.NOT_FOUND).send(html);
      return;
    }

    const content = this.templateBuilder.buildDetail(profile);
    const html = this.renderLayout(
      `Request ${profile.id}`,
      content,
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get(':id/json')
  async detailJson(@Param('id') id: string) {
    const profile = await this.profilerService.getProfileJson(id);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Get('view/summary')
  async summary(@Res() res: Response) {
    const stats = await this.profilerService.getSummaryStats();
    const content = this.templateBuilder.buildSummaryPage(stats);
    const html = this.renderLayout(
      'Summary',
      content,
      'summary',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/queries')
  async listQueries(@Res() res: Response) {
    const queries = await this.profilerService.getQueriesList();
    const content = this.templateBuilder.buildQueriesList(queries);
    const html = this.renderLayout(
      'Database Queries',
      content,
      'queries',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/logs')
  async listLogs(@Res() res: Response, @Query('page') page: number = 1) {
    const { logs, currentPage, totalPages, totalLogs } =
      await this.profilerService.getLogsList(page);
    const content = this.templateBuilder.buildLogsList(
      logs,
      currentPage,
      totalPages,
      totalLogs,
    );
    const html = this.renderLayout(
      'Application Logs',
      content,
      'logs',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/entities')
  async listEntities(@Res() res: Response) {
    const entities = this.entityExplorer.getEntities();
    const content = this.templateBuilder.buildEntitiesList(entities);
    const html = this.renderLayout(
      'Entity Explorer',
      content,
      'entities',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/routes')
  async listRoutes(@Res() res: Response) {
    const routes = this.routeExplorer.getRoutes();
    const content = this.templateBuilder.buildRoutesList(routes);
    const html = this.renderLayout(
      'Routes Explorer',
      content,
      'routes',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/cache')
  async listCache(@Res() res: Response) {
    const cacheOps = await this.profilerService.getCacheList();
    const content = this.templateBuilder.buildCacheList(cacheOps);
    const html = this.renderLayout(
      'Cache Operations',
      content,
      'cache',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/http-calls')
  async listHttpCalls(@Res() res: Response) {
    const calls = await this.profilerService.getHttpCallsList();
    const content = this.templateBuilder.buildHttpCallsList(calls);
    const html = this.renderLayout(
      'Outbound HTTP',
      content,
      'http-calls',
    );

    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('view/health')
  async healthPage(@Res() res: Response) {
    const html = this.renderLayout(
      'Health',
      this.templateBuilder.buildHealthPage(),
      'health',
    );
    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('api/health')
  async healthAudit(@Query('force') force?: string) {
    return this.healthService.runHealthCheck(force === 'true');
  }

  @Get('view/code-quality')
  async codeQualityPage(@Res() res: Response) {
    const html = this.renderLayout(
      'Code Quality',
      this.templateBuilder.buildCodeQualityPage(),
      'code-quality',
    );
    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('api/code-quality')
  async codeQualityAudit(@Query('force') force?: string) {
    return this.codeQualityService.runCheck(force === 'true');
  }

  @Get('view/events')
  async eventsPage(@Res() res: Response) {
    const html = this.renderLayout(
      'Event Tracking',
      this.templateBuilder.buildEventsPage(),
      'events',
    );
    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('api/events')
  async eventsApi() {
    return this.profilerService.getEventsList();
  }

  @Get('view/cron-jobs')
  async cronJobsPage(@Res() res: Response) {
    const report = this.cronExplorer.getReport();
    const cronDataJson = JSON.stringify(report);
    const content = this.viewService.render('cron-jobs', { cronDataJson });
    const html = this.renderLayout('Scheduled Jobs', content, 'cron-jobs');
    res.header('Content-Type', 'text/html').send(html);
  }

  @Get('api/cron-jobs')
  async cronJobsApi() {
    return this.cronExplorer.getReport();
  }

  @Get('view/logs/live')
  async liveLogsPage(@Res() res: Response) {
    const html = this.renderLayout(
      'Live Logs',
      this.templateBuilder.buildLiveLogsPage(),
      'live-logs',
    );
    res.header('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('logs/stream')
  liveLogsStream(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Increase max listeners to avoid Node.js warning when multiple tabs are open
    this.profilerService.logEmitter.setMaxListeners(
      this.profilerService.logEmitter.getMaxListeners() + 1,
    );

    // Immediately confirm the channel is open
    res.write(
      `data: ${JSON.stringify({ level: 'system', message: 'Stream connected', timestamp: Date.now() })}\n\n`,
    );

    // --- Batching: collect logs for 50ms then flush as a single SSE event ---
    // This dramatically reduces the number of HTTP chunks under high log volume.
    const batch: any[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      batchTimer = null;
      if (batch.length === 0 || (res as any).writableEnded) return;
      const payload = batch.splice(0);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    const onLog = (log: any) => {
      if ((res as any).writableEnded) return;
      batch.push(log);
      if (!batchTimer) batchTimer = setTimeout(flush, 50);
    };

    // Heartbeat every 15s keeps proxies from closing idle connections
    const heartbeat = setInterval(() => {
      if (!(res as any).writableEnded) res.write(': heartbeat\n\n');
    }, 15_000);

    this.profilerService.logEmitter.on('log', onLog);

    res.on('close', () => {
      clearInterval(heartbeat);
      if (batchTimer) clearTimeout(batchTimer);
      this.profilerService.logEmitter.off('log', onLog);
      this.profilerService.logEmitter.setMaxListeners(
        Math.max(1, this.profilerService.logEmitter.getMaxListeners() - 1),
      );
    });
  }

  @Get('assets/:file')
  async serveAsset(@Param('file') file: string, @Res() res: Response) {
    const fs = require('fs');
    const path = require('path');
    const assetsPath = path.join(__dirname, '..', 'assets');
    const filePath = path.join(assetsPath, file);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(file);
      let contentType = 'text/plain';
      if (ext === '.png') contentType = 'image/png';
      if (ext === '.ico') contentType = 'image/x-icon';
      if (ext === '.svg') contentType = 'image/svg+xml';
      if (ext === '.css') contentType = 'text/css';
      if (ext === '.js') contentType = 'text/javascript';

      res.header('Content-Type', contentType);
      // Cache for 1 day
      res.header('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(HttpStatus.NOT_FOUND).send('Asset not found');
    }
  }

  @Get('js/:file')
  async serveJs(@Param('file') file: string, @Res() res: Response) {
    const fs = require('fs');
    const path = require('path');
    const jsPath = path.join(__dirname, '..', 'views', 'js');
    const filePath = path.join(jsPath, file);

    if (fs.existsSync(filePath)) {
      res.header('Content-Type', 'text/javascript');
      // Cache for 1 day
      res.header('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(HttpStatus.NOT_FOUND).send('Script not found');
    }
  }
}

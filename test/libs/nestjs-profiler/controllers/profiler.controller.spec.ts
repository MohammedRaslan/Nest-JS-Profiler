import { ProfilerController } from '../../../../libs/nestjs-profiler/src/controllers/profiler.controller';
import type { Response } from 'express';

describe('ProfilerController', () => {
  const profilerService = {
    getDashboardData: jest.fn().mockResolvedValue([]),
    getAllProfilesJson: jest.fn().mockResolvedValue([{ id: '1' }]),
    getProfileDetail: jest.fn().mockResolvedValue({
      id: '1',
      queries: [],
      logs: [],
      cache: [],
      timestamp: Date.now(),
      method: 'GET',
      url: '/',
      startTime: Date.now(),
    } as any),
    getProfileJson: jest.fn().mockResolvedValue({ id: '1' }),
    getQueriesList: jest.fn().mockResolvedValue([]),
    getLogsList: jest.fn().mockResolvedValue({
      logs: [],
      currentPage: 1,
      totalPages: 1,
      totalLogs: 0,
    }),
    getCacheList: jest.fn().mockResolvedValue([]),
  } as any;

  const templateBuilder = {
    buildDashboard: jest.fn().mockReturnValue('<DASH/>'),
    buildQueriesList: jest.fn().mockReturnValue('<Q/>'),
    buildLogsList: jest.fn().mockReturnValue('<L/>'),
    buildEntitiesList: jest.fn().mockReturnValue('<E/>'),
    buildRoutesList: jest.fn().mockReturnValue('<R/>'),
    buildCacheList: jest.fn().mockReturnValue('<C/>'),
    buildDetail: jest.fn().mockReturnValue('<DETAIL/>'),
    buildNotFound: jest.fn().mockReturnValue('<NOTFOUND/>'),
  } as any;

  const entityExplorer = { getEntities: jest.fn().mockReturnValue([]) } as any;
  const routeExplorer = { getRoutes: jest.fn().mockReturnValue([]) } as any;

  const viewService = {
    renderWithLayout: jest.fn().mockReturnValue('<HTML/>'),
  } as any;

  const makeRes = () => {
    const headers: Record<string, string> = {};
    let statusCode: number | undefined;
    let body: any;
    const res: Partial<Response> = {
      header: (k: string, v: string) => {
        headers[k] = v;
        return res as any;
      },
      status: (c: number) => {
        statusCode = c;
        return res as any;
      },
      send: (b: any) => {
        body = b;
        return res as any;
      },
    };
    return {
      res: res as Response,
      headers,
      get statusCode() {
        return statusCode;
      },
      get body() {
        return body;
      },
    };
  };

  it('dashboard returns rendered HTML', async () => {
    const ctrl = new ProfilerController(
      profilerService,
      viewService,
      templateBuilder,
      entityExplorer,
      routeExplorer,
    );
    const ctx = makeRes();
    await ctrl.dashboard(ctx.res);
    expect(viewService.renderWithLayout).toHaveBeenCalled();
    expect(ctx.headers['Content-Type']).toBe('text/html');
    expect(ctx.body).toBe('<HTML/>');
  });

  it('json endpoints return values', async () => {
    const ctrl = new ProfilerController(
      profilerService,
      viewService,
      templateBuilder,
      entityExplorer,
      routeExplorer,
    );
    const list = await ctrl.listJson();
    expect(list).toEqual([{ id: '1' }]);
    const detail = await ctrl.detailJson('1');
    expect(detail).toEqual({ id: '1' });
  });

  it('detail returns 404 layout when not found', async () => {
    const ps = {
      ...profilerService,
      getProfileDetail: jest.fn().mockResolvedValue(null),
    };
    const ctrl = new ProfilerController(
      ps,
      viewService,
      templateBuilder,
      entityExplorer,
      routeExplorer,
    );
    const ctx = makeRes();
    await ctrl.detail('missing', ctx.res);
    expect(ctx.statusCode).toBe(404);
    // Called with title 'Profile Not Found' and some content
    expect(viewService.renderWithLayout).toHaveBeenCalledWith(
      'Profile Not Found',
      expect.any(String),
    );
  });

  it('views: queries/logs/entities/routes/cache return HTML', async () => {
    const ctrl = new ProfilerController(
      profilerService,
      viewService,
      templateBuilder,
      entityExplorer,
      routeExplorer,
    );
    for (const fn of [
      ctrl.listQueries.bind(ctrl),
      ctrl.listLogs.bind(ctrl),
      ctrl.listEntities.bind(ctrl),
      ctrl.listRoutes.bind(ctrl),
      ctrl.listCache.bind(ctrl),
    ]) {
      const ctx = makeRes();
      await fn(ctx.res as any, 1 as any);
      expect(ctx.headers['Content-Type']).toBe('text/html');
      expect(ctx.body).toBe('<HTML/>');
    }
  });

  it('serveAsset and serveJs set headers and pipe streams when file exists', async () => {
    const fs = require('fs');
    const stream = { pipe: jest.fn() };
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(stream);

    const ctrl = new ProfilerController(
      profilerService,
      viewService,
      templateBuilder,
      entityExplorer,
      routeExplorer,
    );
    const ctx1 = makeRes();
    await ctrl.serveAsset('logo.png', ctx1.res);
    expect(ctx1.headers['Content-Type']).toBe('image/png');
    expect(stream.pipe).toHaveBeenCalled();

    const ctx2 = makeRes();
    await ctrl.serveJs('layout.js', ctx2.res);
    expect(ctx2.headers['Content-Type']).toBe('text/javascript');
    expect(stream.pipe).toHaveBeenCalled();
  });
});

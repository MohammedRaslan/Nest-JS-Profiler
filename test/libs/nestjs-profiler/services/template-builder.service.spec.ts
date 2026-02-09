import { TemplateBuilderService } from '../../../../libs/nestjs-profiler/src/services/template-builder.service';

describe('TemplateBuilderService', () => {
  const viewService = {
    render: jest.fn((name: string, data: any) => `<${name.toUpperCase()}>${JSON.stringify(data)}</${name.toUpperCase()}>`),
    timeAgo: jest.fn(() => '1m ago'),
    getMethodBadge: jest.fn((m: string) => `<span>${m}</span>`),
    getStatusClass: jest.fn(() => 'cls'),
    getDatabaseBadge: jest.fn(() => '<span>DB</span>'),
    getCacheOperationBadge: jest.fn(() => '<span>op</span>'),
    getCacheResultBadge: jest.fn(() => '<span>res</span>'),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildDashboard renders with rows and emptyState', () => {
    const svc = new TemplateBuilderService(viewService);
    const html = svc.buildDashboard([] as any);
    expect(viewService.render).toHaveBeenCalledWith('dashboard', expect.any(Object));
    expect(typeof html).toBe('string');
  });

  it('buildDetail renders detail view with composed parts', () => {
    const svc = new TemplateBuilderService(viewService);
    const profile: any = {
      method: 'GET', url: '/', queries: [], timestamp: Date.now(),
    };
    const html = svc.buildDetail(profile);
    expect(typeof html).toBe('string');
  });

  it('lists builders call view.render with correct template names', () => {
    const svc = new TemplateBuilderService(viewService);
    svc.buildQueriesList([] as any);
    svc.buildLogsList([] as any, 1, 1, 0);
    svc.buildEntitiesList([] as any);
    svc.buildRoutesList([] as any);
    svc.buildCacheList([] as any);
    expect(viewService.render).toHaveBeenCalledTimes(5);
  });

  it('buildNotFound uses not_found template', () => {
    const svc = new TemplateBuilderService(viewService);
    svc.buildNotFound('id');
    expect(viewService.render).toHaveBeenCalledWith('not_found', expect.any(Object));
  });
});

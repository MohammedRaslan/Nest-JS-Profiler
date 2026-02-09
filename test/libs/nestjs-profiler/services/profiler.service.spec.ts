import { ProfilerService } from '../../../../libs/nestjs-profiler/src/services/profiler.service';
import type { ProfilerOptions } from '../../../../libs/nestjs-profiler/src/common/profiler-options.interface';
import type { ProfilerStorage } from '../../../../libs/nestjs-profiler/src/storage/profiler-storage.interface';
import type { QueryProfile, LogProfile, CacheProfile, RequestProfile } from '../../../../libs/nestjs-profiler/src/common/profiler.model';

describe('ProfilerService', () => {
  const baseOptions: ProfilerOptions = { enabled: true };
  let saved: RequestProfile[];
  let storage: ProfilerStorage;

  beforeEach(() => {
    saved = [];
    storage = {
      save: (p) => {
        // replace existing by id if present (simulate update)
        const idx = saved.findIndex((x) => x.id === p.id);
        if (idx >= 0) saved[idx] = p; else saved.push(p);
      },
      get: (id) => saved.find((p) => p.id === id) || null,
      all: () => saved,
    };
  });

  it('startRequest creates a new profile and sets ALS context; endRequest finalizes and saves', () => {
    const svc = new ProfilerService(baseOptions as any, storage as any);
    const profile = svc.startRequest();
    expect(profile).toBeTruthy();
    expect(profile!.id).toBeDefined();
    expect(profile!.queries).toEqual([]);

    // Add some data and end
    profile!.method = 'GET';
    profile!.url = '/x';
    svc.endRequest(profile!);

    expect(saved.length).toBe(1);
    const stored = saved[0];
    expect(stored.endTime).toBeDefined();
    expect(stored.duration).toBeGreaterThanOrEqual(0);
    expect(stored.memory).toBeDefined();
  });

  it('addQuery pushes into current profile and triggers save; analyze flags slow and n+1', () => {
    const svc = new ProfilerService(baseOptions as any, storage as any);
    const profile = svc.startRequest()!;

    const fast: QueryProfile = { sql: 'select 1', duration: 10, startTime: Date.now() } as any;
    const slow1: QueryProfile = { sql: 'select * from a where id=$1', duration: 150, startTime: Date.now() } as any;
    const slow2: QueryProfile = { sql: 'select * from a where id=$1', duration: 120, startTime: Date.now() } as any;

    svc.addQuery(fast);
    svc.addQuery(slow1);
    svc.addQuery(slow2);

    expect(saved.length).toBeGreaterThan(0); // saved after addQuery
    expect(profile.queries.length).toBe(3);

    svc.endRequest(profile);

    // After analyzeRequest: slow queries tagged and duplicates marked as n+1
    const [q0, q1, q2] = saved[0].queries;
    expect(q0.tags || []).not.toContain('slow');
    expect(q1.tags).toContain('slow');
    expect(q2.tags).toContain('slow');
    // Duplicates group
    expect(q1.tags).toContain('n+1');
    expect(q2.tags).toContain('n+1');
    expect(q1.duplicatedCount).toBe(2);
    expect(q2.duplicatedCount).toBe(2);
  });

  it('addLog and addCache append entries and persist', () => {
    const svc = new ProfilerService(baseOptions as any, storage as any);
    const profile = svc.startRequest()!;

    const log: LogProfile = { level: 'info', message: 'hello', timestamp: Date.now() };
    const cache: CacheProfile = {
      key: 'a', store: 'memory', operation: 'get', result: 'hit', ttl: 10,
      duration: 2, startTime: Date.now(), value: 1,
    };
    (svc as any).addLog(log);
    (svc as any).addCache(cache);

    expect(profile.logs.length).toBe(1);
    expect(profile.cache!.length).toBe(1);
    expect(saved.length).toBeGreaterThan(0);
  });

  it('getDashboardData and getProfileDetail delegate to storage', async () => {
    const svc = new ProfilerService(baseOptions as any, storage as any);
    const p = svc.startRequest()!;
    p.method = 'GET'; p.url = '/';
    svc.endRequest(p);

    const dash = await svc.getDashboardData();
    expect(Array.isArray(dash)).toBe(true);

    const detail = await svc.getProfileDetail(p.id);
    expect(detail?.id).toBe(p.id);
  });

  it('lists: getQueriesList, getLogsList, getCacheList compute and sort correctly', async () => {
    const svc = new ProfilerService(baseOptions as any, storage as any);
    const p = svc.startRequest()!;
    p.method = 'GET'; p.url = '/a';
    svc.addQuery({ sql: 'A', duration: 5, startTime: Date.now() - 100 } as any);
    svc.addQuery({ sql: 'B', duration: 50, startTime: Date.now() - 50 } as any);
    (svc as any).addLog({ level: 'warn', message: 'm', timestamp: Date.now() - 10 });
    (svc as any).addCache({ key: 'k', store: 's', operation: 'get', result: 'hit', duration: 1, startTime: Date.now() - 20 });
    svc.endRequest(p);

    const queries = await svc.getQueriesList();
    expect(queries.length).toBe(2);
    // Sorted by duration desc
    expect(queries[0].duration).toBeGreaterThanOrEqual(queries[1].duration);

    const { logs, totalLogs } = await svc.getLogsList(1, 50);
    expect(totalLogs).toBe(1);
    expect(logs[0].message).toBe('m');

    const cache = await svc.getCacheList();
    expect(cache.length).toBe(1);
  });
});

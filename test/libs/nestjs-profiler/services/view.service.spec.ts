import { ViewService } from '../../../../libs/nestjs-profiler/src/services/view.service';

describe('ViewService', () => {
  let svc: ViewService;
  beforeEach(() => {
    svc = new ViewService();
  });

  it('render loads and interpolates templates', () => {
    // Use a known template: dashboard.html includes {{{ rows }}}
    const html = svc.render('dashboard', { rows: '<tr><td>x</td></tr>', emptyState: '' });
    expect(html).toContain('<tr>');
  });

  it('renderWithLayout injects title, content and sets active tab classes', () => {
    const html = svc.renderWithLayout('T', '<div id="c"></div>', 'queries');
    expect(html).toContain('<title>T - NestJS Profiler</title>');
    expect(html).toContain('<div id="c"></div>');
    // Queries link should have active classes
    expect(html).toContain('href="/__profiler/view/queries"');
    expect(html).toContain('bg-indigo-600 text-white');
  });

  it('timeAgo produces human readable output', () => {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const s = svc.timeAgo(oneMinuteAgo);
    expect(s).toMatch(/m ago|s ago/);
  });

  it('method/database/cache badges include labels', () => {
    expect(svc.getMethodBadge('GET')).toContain('GET');
    expect(svc.getDatabaseBadge('mongodb')).toContain('MongoDB');
    expect(svc.getCacheOperationBadge('get')).toContain('GET'.toLowerCase());
    expect(svc.getCacheResultBadge('hit')).toContain('HIT'.toLowerCase());
  });
});

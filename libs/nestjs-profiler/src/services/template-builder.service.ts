import { Injectable } from '@nestjs/common';
import { RequestProfile, QueryProfile, LogProfile, HttpCallProfile } from '../common/profiler.model';
import { ViewService } from './view.service';

@Injectable()
export class TemplateBuilderService {
    constructor(private readonly viewService: ViewService) { }

    /** Build live logs terminal page (no dynamic data — all rendered client-side via SSE) */
    buildLiveLogsPage(): string {
        return this.viewService.render('live-logs', {});
    }

    /** Build health page shell — all data fetched client-side via /__profiler/api/health */
    buildHealthPage(): string {
        return this.viewService.render('health', {});
    }

    /** Build code quality page shell — all data fetched client-side via /__profiler/api/code-quality */
    buildCodeQualityPage(): string {
        return this.viewService.render('code-quality', {});
    }

    /**
     * Build the summary/stats dashboard page
     */
    buildSummaryPage(stats: Awaited<ReturnType<import('./profiler.service').ProfilerService['getSummaryStats']>>): string {
        const errorCount = Math.round(stats.totalRequests * stats.errorRate / 100);
        const avgQueriesPerRequest = stats.totalRequests > 0
            ? (stats.totalQueries / stats.totalRequests).toFixed(1)
            : '0';

        // Error rate styling
        const errorRateBadgeClass = stats.errorRate > 10 ? 'bg-red-50' : stats.errorRate > 0 ? 'bg-yellow-50' : 'bg-green-50';
        const errorRateTextClass = stats.errorRate > 10 ? 'text-red-600' : stats.errorRate > 0 ? 'text-yellow-600' : 'text-gray-900';

        // Slow queries styling
        const slowQueriesTextClass = stats.slowQueries > 0 ? 'text-yellow-600' : 'text-gray-900';

        // N+1 styling
        const nPlusOneBadgeClass = stats.nPlusOneCount > 0 ? 'bg-orange-50' : 'bg-green-50';
        const nPlusOneIconClass = stats.nPlusOneCount > 0 ? 'text-orange-500' : 'text-green-600';
        const nPlusOneTextClass = stats.nPlusOneCount > 0 ? 'text-orange-600' : 'text-gray-900';

        // Method distribution bars
        const methodColors: Record<string, string> = {
            GET: 'bg-blue-500', POST: 'bg-green-500', PUT: 'bg-orange-500',
            PATCH: 'bg-yellow-500', DELETE: 'bg-red-500',
        };
        const totalReqs = stats.totalRequests || 1;
        const methodBars = Object.entries(stats.methodDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([method, count]) => {
                const pct = Math.round((count / totalReqs) * 100);
                const color = methodColors[method] || 'bg-gray-400';
                return `
                <div class="mb-3">
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span class="font-medium">${method}</span>
                        <span>${count} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                        <div class="${color} h-2 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
            }).join('') || '<p class="text-sm text-gray-400 italic">No data</p>';

        // Status distribution bars
        const statusColors: Record<string, string> = {
            '2xx': 'bg-green-500', '3xx': 'bg-blue-400',
            '4xx': 'bg-yellow-500', '5xx': 'bg-red-500', 'unknown': 'bg-gray-400',
        };
        const statusBars = Object.entries(stats.statusDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([bucket, count]) => {
                const pct = Math.round((count / totalReqs) * 100);
                const color = statusColors[bucket] || 'bg-gray-400';
                return `
                <div class="mb-3">
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span class="font-medium">${bucket}</span>
                        <span>${count} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                        <div class="${color} h-2 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
            }).join('') || '<p class="text-sm text-gray-400 italic">No data</p>';

        // Top slow endpoints table
        const topEndpointsTable = stats.topSlowEndpoints.length > 0
            ? `<table class="w-full text-sm">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                        <th class="px-4 py-2 text-left">Endpoint</th>
                        <th class="px-4 py-2 text-right">Calls</th>
                        <th class="px-4 py-2 text-right">Avg</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                ${stats.topSlowEndpoints.map(e => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3">
                            <a href="/__profiler/view/requests?search=${encodeURIComponent(e.route)}" class="group inline-flex items-center gap-1.5 hover:underline">
                                <span class="inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${this.getMethodBadgeClass(e.method)}">${e.method}</span>
                                <span class="font-mono text-xs text-gray-700 group-hover:text-indigo-600 truncate">${e.route}</span>
                            </a>
                        </td>
                        <td class="px-4 py-3 text-right text-xs text-gray-500">${e.callCount}</td>
                        <td class="px-4 py-3 text-right text-xs font-semibold ${e.avgDuration > 500 ? 'text-red-600' : e.avgDuration > 100 ? 'text-yellow-600' : 'text-gray-700'}">${Math.round(e.avgDuration)}ms</td>
                    </tr>`).join('')}
                </tbody>
            </table>`
            : '<div class="p-6 text-center text-sm text-gray-400 italic">No endpoint data yet</div>';

        // Top slow queries table
        const topQueriesTable = stats.topSlowQueries.length > 0
            ? `<div class="divide-y divide-gray-100">
                ${stats.topSlowQueries.map(q => `
                    <div class="px-5 py-3">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-mono text-xs text-gray-400 truncate max-w-xs">${q.requestUrl}</span>
                            <span class="text-xs font-bold ${q.duration > 500 ? 'text-red-600' : q.duration > 100 ? 'text-yellow-600' : 'text-gray-600'} ml-2 flex-shrink-0">${q.duration}ms</span>
                        </div>
                        <pre class="text-xs text-gray-700 font-mono bg-gray-50 rounded px-2 py-1 truncate overflow-hidden">${(q.sql || '').substring(0, 120)}${(q.sql || '').length > 120 ? '...' : ''}</pre>
                    </div>`).join('')}
            </div>`
            : '<div class="p-6 text-center text-sm text-gray-400 italic">No query data yet</div>';

        // Recent errors section
        const recentErrorsSection = stats.recentErrors.length > 0
            ? `<div class="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                <div class="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
                    <svg class="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <h3 class="text-sm font-semibold text-red-800">Recent Errors</h3>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                            <th class="px-4 py-2 text-left">Endpoint</th>
                            <th class="px-4 py-2 text-left">Status</th>
                            <th class="px-4 py-2 text-left">Message</th>
                            <th class="px-4 py-2 text-right">When</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    ${stats.recentErrors.map(e => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3">
                                <a href="/__profiler/${e.id}" class="group inline-flex items-center gap-1.5 hover:underline">
                                    <span class="inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${this.getMethodBadgeClass(e.method)}">${e.method}</span>
                                    <span class="font-mono text-xs text-gray-700 group-hover:text-indigo-600">${e.url}</span>
                                </a>
                            </td>
                            <td class="px-4 py-3"><span class="text-xs font-bold text-red-600">${e.statusCode}</span></td>
                            <td class="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">${e.message || '-'}</td>
                            <td class="px-4 py-3 text-right text-xs text-gray-400">${this.viewService.timeAgo(e.timestamp)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`
            : '';

        return this.viewService.render('summary', {
            totalRequests: stats.totalRequests,
            avgDuration: stats.avgDuration,
            p95Duration: stats.p95Duration,
            errorRate: stats.errorRate,
            errorCount,
            errorRateBadgeClass,
            errorRateTextClass,
            totalQueries: stats.totalQueries,
            avgQueriesPerRequest,
            slowQueries: stats.slowQueries,
            slowQueriesTextClass,
            nPlusOneCount: stats.nPlusOneCount,
            nPlusOneBadgeClass,
            nPlusOneIconClass,
            nPlusOneTextClass,
            seqScanCount: stats.seqScanCount,
            cacheHitRate: stats.cacheHitRate,
            totalCacheOps: stats.totalCacheOps,
            heapUsed: stats.memoryUsage?.heapUsed ?? '-',
            heapTotal: stats.memoryUsage?.heapTotal ?? '-',
            rss: stats.memoryUsage?.rss ?? '-',
            methodBars,
            statusBars,
            topEndpointsTable,
            topQueriesTable,
            recentErrorsSection,
        });
    }

    private getMethodBadgeClass(method: string): string {
        const classes: Record<string, string> = {
            GET: 'bg-blue-100 text-blue-800',
            POST: 'bg-green-100 text-green-800',
            PUT: 'bg-orange-100 text-orange-800',
            PATCH: 'bg-yellow-100 text-yellow-800',
            DELETE: 'bg-red-100 text-red-800',
        };
        return classes[method] || 'bg-gray-100 text-gray-800';
    }

    /**
     * Build dashboard HTML
     */
    buildDashboard(profiles: RequestProfile[]): string {
        const rows = profiles.map(p => this.buildRequestRow(p)).join('');
        const emptyState = !rows ? '<div class="p-8 text-center text-gray-500">No requests captured yet.</div>' : '';

        return this.viewService.render('dashboard', {
            rows,
            emptyState
        });
    }

    /**
     * Build request detail HTML
     */
    buildDetail(profile: RequestProfile): string {
        const queries = profile.queries.map((q, i) => this.buildQueryDetail(q, i)).join('') ||
            '<div class="text-center text-gray-400 py-8 italic">No queries executed during this request.</div>';

        const statusCode = profile.statusCode || 200;
        const statusColor = this.getStatusColor(statusCode);

        return this.viewService.render('detail', {
            method: profile.method,
            url: profile.url,
            statusColor,
            timeAgo: this.viewService.timeAgo(profile.timestamp),
            queryCount: profile.queries.length,
            queries,
            sidebar: this.buildMetadataSidebar(profile),
            headersTable: this.buildHeadersTable(profile.requestHeaders),
            bodyView: this.buildBodyView(profile.requestBody),
            exceptionView: this.buildExceptionView(profile.exception),
            timingBar: this.buildTimingBar(profile.timings, profile.duration || 0),
            cacheSection: this.buildCacheSection(profile.cache || []),
            httpCallsSection: this.buildHttpCallsSection(profile.httpCalls || []),
        });
    }

    private buildHeadersTable(headers: any): string {
        if (!headers || Object.keys(headers).length === 0) return '<div class="text-gray-400 italic">No headers captured</div>';

        const rows = Object.entries(headers).map(([key, value]) => `
            <tr class="border-b border-gray-100 last:border-0">
                <td class="py-2 px-3 text-xs font-semibold text-gray-600 font-mono whitespace-nowrap bg-gray-50 w-1/3">${key}</td>
                <td class="py-2 px-3 text-xs text-gray-700 font-mono break-all">${value}</td>
            </tr>
        `).join('');

        return `<table class="w-full border-collapse border border-gray-200 rounded hidden md:table">${rows}</table>`;
    }

    private buildBodyView(body: any): string {
        if (!body) return '<div class="text-gray-400 italic">No body content</div>';

        const content = typeof body === 'object' ? JSON.stringify(body, null, 2) : body;
        return `<pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">${content}</pre>`;
    }

    private buildExceptionView(exception: any): string {
        if (!exception) return '';

        return `
            <div class="mb-6 bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                <div class="px-4 py-3 bg-red-100 border-b border-red-200 flex items-center">
                    <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h3 class="font-bold text-red-800">Exception: ${exception.message}</h3>
                </div>
                <div class="p-4">
                    <pre class="text-xs text-red-700 font-mono whitespace-pre-wrap overflow-x-auto">${exception.stack}</pre>
                </div>
            </div>
        `;
    }

    private buildTimingBar(timings: any, totalDuration: number): string {
        if (!timings) return '';

        const middlewarePct = (timings.middleware / timings.total) * 100;
        const handlerPct = (timings.handler / timings.total) * 100;

        return `
            <div class="mt-6 mb-8">
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Execution Timing</h3>
                <div class="h-4 bg-gray-100 rounded-full overflow-hidden flex w-full">
                    <div class="h-full bg-blue-200" style="width: ${middlewarePct}%" title="Middleware/Guards: ${timings.middleware.toFixed(2)}ms"></div>
                    <div class="h-full bg-indigo-500" style="width: ${handlerPct}%" title="Handler/Interceptor: ${timings.handler.toFixed(2)}ms"></div>
                </div>
                <div class="flex justify-between mt-2 text-xs text-gray-500">
                    <div class="flex items-center">
                        <span class="w-3 h-3 bg-blue-200 rounded-sm mr-1"></span>
                        Middleware: <strong>${timings.middleware.toFixed(2)}ms</strong>
                    </div>
                    <div class="flex items-center">
                        <span class="w-3 h-3 bg-indigo-500 rounded-sm mr-1"></span>
                        Handler: <strong>${timings.handler.toFixed(2)}ms</strong>
                    </div>
                    <div>
                        Total: <strong>${timings.total.toFixed(2)}ms</strong>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Build queries list HTML
     */
    buildQueriesList(queries: any[]): string {
        const rows = queries.map(q => this.viewService.render('partials/query_row', {
            sql: q.sql,
            duration: q.duration.toFixed(2),
            requestId: q.requestId,
            requestMethod: q.requestMethod,
            requestUrl: q.requestUrl,
            timeAgo: this.viewService.timeAgo(q.startTime)
        })).join('') || '<tr><td colspan="3" class="p-8 text-center text-gray-500">No queries found.</td></tr>';

        return this.viewService.render('queries', { rows });
    }

    /**
     * Build logs list HTML
     */
    buildLogsList(logs: any[], currentPage: number, totalPages: number, totalLogs: number): string {
        const rows = logs.map(l => this.buildLogRow(l)).join('') ||
            '<tr><td colspan="4" class="p-8 text-center text-gray-500">No logs captured.</td></tr>';

        return this.viewService.render('logs', {
            totalLogs,
            rows,
            pagination: this.buildPagination(currentPage, totalPages)
        });
    }

    /**
     * Build entities list HTML
     */
    buildEntitiesList(entities: any[]): string {
        const rows = entities.map(e => this.viewService.render('partials/entity_row', {
            name: e.name,
            typeBadge: this.viewService.getDatabaseBadge(e.type),
            database: e.database,
            connection: e.connection,
            tableName: e.tableName || '-',
            columnsCount: e.columns?.length || 0,
            columnsJson: JSON.stringify(e.columns || []),
            rowId: `entity-${Math.random().toString(36).substr(2, 9)}`
        })).join('');

        const emptyState = !rows ? '<div class="p-8 text-center text-gray-500">No entities found.</div>' : '';

        return this.viewService.render('entities', {
            totalEntities: entities.length,
            rows,
            emptyState
        });
    }

    /**
     * Build 404 not found page
     */
    buildNotFound(id: string): string {
        return this.viewService.render('not_found', { id });
    }

    /**
     * Build routes list HTML
     */
    buildRoutesList(routes: any[]): string {
        const rows = routes.map(r => this.viewService.render('partials/route_row', {
            methodBadge: this.viewService.getMethodBadge(r.method),
            method: r.method,
            path: r.path,
            controller: r.controller,
            handler: r.handler
        })).join('');

        const emptyState = !rows ? '<div class="p-8 text-center text-gray-500">No routes found.</div>' : '';

        return this.viewService.render('routes', {
            totalRoutes: routes.length,
            rows,
            emptyState
        });
    }

    /**
     * Build cache list HTML
     */
    buildCacheList(cacheOps: any[]): string {
        const rows = cacheOps.map(c => this.viewService.render('partials/cache_row', {
            operationBadge: this.viewService.getCacheOperationBadge(c.operation),
            key: c.key,
            resultBadge: this.viewService.getCacheResultBadge(c.result),
            store: c.store,
            duration: c.duration.toFixed(2),
            timeAgo: this.viewService.timeAgo(c.startTime)
        })).join('');

        const emptyState = !rows ? '<div class="p-8 text-center text-gray-500">No cache operations recorded.</div>' : '';

        return this.viewService.render('cache', {
            totalCacheOps: cacheOps.length,
            rows,
            emptyState
        });
    }


    // ==================== Private Fragment Helpers ====================

    private buildRequestRow(p: RequestProfile): string {
        const statusCode = p.statusCode || 200;

        return this.viewService.render('partials/request_row', {
            methodBadge: this.viewService.getMethodBadge(p.method),
            method: p.method,
            id: p.id,
            url: p.url,
            statusClass: this.viewService.getStatusClass(statusCode),
            statusCode: statusCode,
            duration: p.duration,
            queriesCount: p.queries.length > 0 ? `<span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">${p.queries.length}</span>` : '<span class="text-gray-300">-</span>',
            timeAgo: this.viewService.timeAgo(p.timestamp)
        });
    }

    private buildQueryDetail(q: any, index: number): string {
        return this.viewService.render('partials/detail_query_row', {
            open: index < 3 ? 'open' : '',
            index: index + 1,
            dbBadge: this.viewService.getDatabaseBadge(q.database),
            opBadge: q.operation ? `<span class="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">${q.operation}</span>` : '',
            connection: q.connection ? `<span class="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 bg-gray-50">${q.connection}</span>` : '',
            durationClass: this.getDurationClass(q),
            duration: q.duration.toFixed(2),
            rowCount: q.rowCount ?? '-',
            query: q.database === 'mongodb' && q.query ? q.query : q.sql,
            tagsBadges: (q.tags || []).map((t: string) => this.getTagBadge(t)).join(''),
            duplicationWarning: q.duplicatedCount > 1 ? `<div class="mt-1 text-xs text-orange-600 font-medium flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Executed ${q.duplicatedCount} times (N+1)</div>` : '',
            planType: q.planType ? `<span class="ml-2 text-xs text-gray-400">(${q.planType})</span>` : '',
            params: q.params && q.params.length ? `
                <div class="mt-2 text-xs">
                    <span class="text-gray-500 font-semibold">Parameters:</span>
                    <code class="text-gray-700 bg-gray-100 px-1 py-0.5 rounded ml-1 font-mono">${JSON.stringify(q.params)}</code>
                </div>
            ` : '',
            filter: q.filter && q.database === 'mongodb' ? `
                <div class="mt-2 text-xs">
                    <span class="text-gray-500 font-semibold">Filter:</span>
                    <pre class="text-gray-700 bg-gray-100 p-2 rounded mt-1 font-mono text-xs overflow-x-auto">${JSON.stringify(q.filter, null, 2)}</pre>
                </div>
            ` : '',
            explainPlan: q.explainPlan ? `
                <div class="mt-3 border-t border-gray-100 pt-3">
                    <details class="group">
                        <summary class="text-xs font-medium text-indigo-600 cursor-pointer hover:text-indigo-800 select-none flex items-center">
                            <svg class="w-4 h-4 mr-1 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            View Explain Plan
                        </summary>
                        <pre class="mt-2 bg-gray-50 p-3 rounded text-xs text-gray-600 overflow-x-auto border border-gray-200">${JSON.stringify(q.explainPlan, null, 2)}</pre>
                    </details>
                </div>
            ` : '',
            error: q.error ? `
                <div class="mt-3 bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">
                    <strong>Error:</strong> ${q.error}
                </div>
            ` : ''
        });
    }

    private getTagBadge(tag: string): string {
        const styles: Record<string, string> = {
            'slow': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'n+1': 'bg-orange-100 text-orange-800 border-orange-200',
            'seq-scan': 'bg-red-100 text-red-800 border-red-200'
        };
        const style = styles[tag] || 'bg-gray-100 text-gray-600 border-gray-200';
        return `<span class="ml-2 text-xs px-2 py-0.5 rounded border ${style} font-medium tracking-wide uppercase shadow-sm" style="font-size: 0.65rem;">${tag}</span>`;
    }

    private getDurationClass(q: any): string {
        if (q.error) return 'text-red-700 bg-red-50';
        if (q.duration > 100) return 'text-yellow-700 bg-yellow-50 font-bold';
        return 'text-gray-600 bg-gray-100';
    }

    private buildMetadataSidebar(p: RequestProfile): string {
        return this.viewService.render('partials/metadata_sidebar', {
            statusColor: (p.statusCode || 200) >= 400 ? 'text-red-600' : 'text-green-600',
            statusCode: p.statusCode || 200,
            duration: p.duration,
            memory: p.memory ? Math.round(p.memory.rss / 1024 / 1024) + ' MB' : '-',
            controller: p.controller || '-',
            handler: p.handler || '-'
        });
    }

    private buildLogRow(l: any): string {
        return this.viewService.render('partials/log_row', {
            levelColor: this.viewService.getLogLevelColor(l.level),
            level: l.level,
            message: l.message,
            context: l.context ? `<span class="ml-2 text-xs text-gray-500">[${l.context}]</span>` : '',
            requestId: l.requestId,
            requestMethod: l.requestMethod,
            requestUrl: l.requestUrl,
            timeAgo: this.viewService.timeAgo(l.timestamp)
        });
    }

    private buildPagination(currentPage: number, totalPages: number): string {
        if (totalPages <= 1) return '';

        return this.viewService.render('partials/pagination', {
            currentPage,
            totalPages,
            previousPage: currentPage > 1 ? `
                <a href="/__profiler/view/logs?page=${currentPage - 1}" class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Previous
                </a>
            ` : `
                <span class="px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed">
                    Previous
                </span>
            `,
            nextPage: currentPage < totalPages ? `
                <a href="/__profiler/view/logs?page=${currentPage + 1}" class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Next
                </a>
            ` : `
                <span class="px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed">
                    Next
                </span>
            `
        });
    }

    private getStatusColor(statusCode: number): string {
        if (statusCode >= 500) return 'bg-red-500';
        if (statusCode >= 400) return 'bg-yellow-500';
        if (statusCode >= 300) return 'bg-blue-500';
        return 'bg-green-500';
    }

    /**
     * Build global HTTP calls list page
     */
    buildHttpCallsList(calls: any[]): string {
        const rows = calls.map(c => {
            const statusClass = !c.statusCode ? 'text-gray-400'
                : c.statusCode >= 500 ? 'text-red-600 font-bold'
                : c.statusCode >= 400 ? 'text-yellow-600 font-bold'
                : 'text-green-600';
            const durationClass = c.error ? 'text-red-600' : c.duration > 500 ? 'text-red-600 font-bold' : c.duration > 200 ? 'text-yellow-600' : 'text-gray-600';
            const protocolBadge = c.protocol === 'https'
                ? '<span class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">HTTPS</span>'
                : '<span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">HTTP</span>';
            return `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="p-3 whitespace-nowrap">
                    ${this.viewService.getMethodBadge(c.method)}
                </td>
                <td class="p-3 max-w-xs">
                    <div class="flex items-center gap-1.5">
                        ${protocolBadge}
                        <span class="font-mono text-xs text-gray-800 truncate" title="${c.url}">${c.url}</span>
                    </div>
                    ${c.error ? `<div class="text-xs text-red-600 mt-0.5">Error: ${c.error}</div>` : ''}
                </td>
                <td class="p-3 whitespace-nowrap">
                    <span class="text-sm ${statusClass}">${c.statusCode ?? '-'}</span>
                </td>
                <td class="p-3 whitespace-nowrap text-right">
                    <span class="text-sm ${durationClass}">${c.duration}ms</span>
                </td>
                <td class="p-3 whitespace-nowrap">
                    <a href="/__profiler/${c.requestId}" class="text-xs text-indigo-600 hover:underline font-mono truncate block max-w-[140px]" title="${c.requestUrl}">
                        ${c.requestMethod} ${c.requestUrl}
                    </a>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="p-8 text-center text-gray-500">No outbound HTTP calls recorded.</td></tr>';

        return `
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 class="font-semibold text-gray-700">Outbound HTTP Calls</h2>
                <span class="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-md">${calls.length} calls</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider font-medium">
                        <tr>
                            <th class="p-3 border-b border-gray-200 w-16">Method</th>
                            <th class="p-3 border-b border-gray-200">URL</th>
                            <th class="p-3 border-b border-gray-200 w-16">Status</th>
                            <th class="p-3 border-b border-gray-200 w-24 text-right">Duration</th>
                            <th class="p-3 border-b border-gray-200 w-40">Triggered by</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
    }

    private buildHttpCallsSection(calls: HttpCallProfile[]): string {
        if (!calls || calls.length === 0) return '';

        const rows = calls.map(c => {
            const statusClass = !c.statusCode ? 'text-gray-400'
                : c.statusCode >= 500 ? 'text-red-600 font-bold'
                : c.statusCode >= 400 ? 'text-yellow-600 font-bold'
                : 'text-green-600';
            const durationClass = c.error ? 'text-red-600' : c.duration > 500 ? 'text-red-600 font-bold' : c.duration > 200 ? 'text-yellow-600' : 'text-gray-600';
            const protocolBadge = c.protocol === 'https'
                ? '<span class="text-xs px-1 py-0.5 rounded bg-green-100 text-green-700 font-semibold">HTTPS</span>'
                : '<span class="text-xs px-1 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">HTTP</span>';
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2.5 whitespace-nowrap">${this.viewService.getMethodBadge(c.method)}</td>
                    <td class="px-4 py-2.5">
                        <div class="flex items-center gap-1.5">
                            ${protocolBadge}
                            <span class="font-mono text-xs text-gray-800 break-all">${c.url}</span>
                        </div>
                        ${c.error ? `<div class="text-xs text-red-600 mt-0.5">Error: ${c.error}</div>` : ''}
                    </td>
                    <td class="px-4 py-2.5 whitespace-nowrap text-center">
                        <span class="text-sm ${statusClass}">${c.statusCode ?? '—'}</span>
                    </td>
                    <td class="px-4 py-2.5 whitespace-nowrap text-right">
                        <span class="text-sm ${durationClass}">${c.duration}ms</span>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Outbound HTTP Calls (${calls.length})</h2>
                <div class="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Method</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">Status</th>
                                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Duration</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    private buildCacheSection(cache: any[]): string {
        if (!cache || cache.length === 0) return '';

        const rows = cache.map(c => this.viewService.render('partials/cache_row', {
            operationBadge: this.viewService.getCacheOperationBadge(c.operation),
            key: c.key,
            resultBadge: this.viewService.getCacheResultBadge(c.result),
            store: c.store,
            duration: c.duration.toFixed(2),
            timeAgo: this.viewService.timeAgo(c.startTime)
        })).join('');

        return `
            <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Cache Operations (${cache.length})</h2>
                <div class="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Op</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

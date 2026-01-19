"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateBuilderService = void 0;
const common_1 = require("@nestjs/common");
const view_service_1 = require("./view.service");
let TemplateBuilderService = class TemplateBuilderService {
    viewService;
    constructor(viewService) {
        this.viewService = viewService;
    }
    buildDashboard(profiles) {
        const rows = profiles.map(p => this.buildRequestRow(p)).join('');
        const emptyState = !rows ? '<div class="p-8 text-center text-gray-500">No requests captured yet.</div>' : '';
        return this.viewService.render('dashboard', {
            rows,
            emptyState
        });
    }
    buildDetail(profile) {
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
            timingBar: this.buildTimingBar(profile.timings, profile.duration || 0)
        });
    }
    buildHeadersTable(headers) {
        if (!headers || Object.keys(headers).length === 0)
            return '<div class="text-gray-400 italic">No headers captured</div>';
        const rows = Object.entries(headers).map(([key, value]) => `
            <tr class="border-b border-gray-100 last:border-0">
                <td class="py-2 px-3 text-xs font-semibold text-gray-600 font-mono whitespace-nowrap bg-gray-50 w-1/3">${key}</td>
                <td class="py-2 px-3 text-xs text-gray-700 font-mono break-all">${value}</td>
            </tr>
        `).join('');
        return `<table class="w-full border-collapse border border-gray-200 rounded hidden md:table">${rows}</table>`;
    }
    buildBodyView(body) {
        if (!body)
            return '<div class="text-gray-400 italic">No body content</div>';
        const content = typeof body === 'object' ? JSON.stringify(body, null, 2) : body;
        return `<pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">${content}</pre>`;
    }
    buildExceptionView(exception) {
        if (!exception)
            return '';
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
    buildTimingBar(timings, totalDuration) {
        if (!timings)
            return '';
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
    buildQueriesList(queries) {
        const rows = queries.map(q => this.viewService.render('partials/query_row', {
            sql: q.sql,
            duration: q.duration.toFixed(2),
            requestId: q.requestId,
            requestMethod: q.requestMethod,
            requestUrl: q.requestUrl,
            timeAgo: this.viewService.timeAgo(q.startTime)
        })).join('') || '<tr><td colspan="4" class="p-8 text-center text-gray-500">No queries found.</td></tr>';
        return this.viewService.render('queries', { rows });
    }
    buildLogsList(logs, currentPage, totalPages, totalLogs) {
        const rows = logs.map(l => this.buildLogRow(l)).join('') ||
            '<tr><td colspan="4" class="p-8 text-center text-gray-500">No logs captured.</td></tr>';
        return this.viewService.render('logs', {
            totalLogs,
            rows,
            pagination: this.buildPagination(currentPage, totalPages)
        });
    }
    buildEntitiesList(entities) {
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
    buildNotFound(id) {
        return this.viewService.render('not_found', { id });
    }
    buildRequestRow(p) {
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
    buildQueryDetail(q, index) {
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
            tagsBadges: (q.tags || []).map((t) => this.getTagBadge(t)).join(''),
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
    getTagBadge(tag) {
        const styles = {
            'slow': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'n+1': 'bg-orange-100 text-orange-800 border-orange-200',
            'seq-scan': 'bg-red-100 text-red-800 border-red-200'
        };
        const style = styles[tag] || 'bg-gray-100 text-gray-600 border-gray-200';
        return `<span class="ml-2 text-xs px-2 py-0.5 rounded border ${style} font-medium tracking-wide uppercase shadow-sm" style="font-size: 0.65rem;">${tag}</span>`;
    }
    getDurationClass(q) {
        if (q.error)
            return 'text-red-700 bg-red-50';
        if (q.duration > 100)
            return 'text-yellow-700 bg-yellow-50 font-bold';
        return 'text-gray-600 bg-gray-100';
    }
    buildMetadataSidebar(p) {
        return this.viewService.render('partials/metadata_sidebar', {
            statusColor: (p.statusCode || 200) >= 400 ? 'text-red-600' : 'text-green-600',
            statusCode: p.statusCode || 200,
            duration: p.duration,
            memory: p.memory ? Math.round(p.memory.rss / 1024 / 1024) + ' MB' : '-',
            controller: p.controller || '-',
            handler: p.handler || '-'
        });
    }
    buildLogRow(l) {
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
    buildPagination(currentPage, totalPages) {
        if (totalPages <= 1)
            return '';
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
    getStatusColor(statusCode) {
        if (statusCode >= 500)
            return 'bg-red-500';
        if (statusCode >= 400)
            return 'bg-yellow-500';
        if (statusCode >= 300)
            return 'bg-blue-500';
        return 'bg-green-500';
    }
};
exports.TemplateBuilderService = TemplateBuilderService;
exports.TemplateBuilderService = TemplateBuilderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [view_service_1.ViewService])
], TemplateBuilderService);
//# sourceMappingURL=template-builder.service.js.map
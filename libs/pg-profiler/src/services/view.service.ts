import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ViewService {
    private readonly viewsPath: string;

    constructor() {
        // In NestJS libraries, assets are copied to dist/libs/pg-profiler/src/views
        // __dirname is usually dist/libs/pg-profiler/src/services
        this.viewsPath = path.join(__dirname, '..', 'views');
    }

    /**
     * Check if a template exists
     */
    exists(viewName: string): boolean {
        const viewPath = path.join(this.viewsPath, `${viewName}.html`);
        return fs.existsSync(viewPath);
    }
    render(viewName: string, data: any = {}): string {
        const viewPath = path.join(this.viewsPath, `${viewName}.html`);
        let template = this.loadTemplate(viewPath);

        // Replace variables in template
        template = this.interpolate(template, data);

        return template;
    }

    /**
     * Render with layout
     */
    renderWithLayout(title: string, content: string, activeTab: string = 'requests'): string {
        const layoutPath = path.join(this.viewsPath, 'layout.html');
        let layout = this.loadTemplate(layoutPath);

        const data = {
            title,
            content,
            activeTab,
            activeClass: 'bg-indigo-600 text-white',
            inactiveClass: 'text-slate-300 hover:bg-slate-800 hover:text-white',
            requestsActive: activeTab === 'requests' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            queriesActive: activeTab === 'queries' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            logsActive: activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            entitiesActive: activeTab === 'entities' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            requestsIconClass: activeTab === 'requests' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
            queriesIconClass: activeTab === 'queries' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
            logsIconClass: activeTab === 'logs' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
            entitiesIconClass: activeTab === 'entities' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
        };

        layout = this.interpolate(layout, data);

        return layout;
    }

    /**
     * Load template from file
     */
    private loadTemplate(filePath: string): string {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to load template: ${filePath}`);
        }
    }

    /**
     * Simple template interpolation
     * Supports: {{ variable }}, {{{ raw }}}, and @if/@endif conditionals
     */
    private interpolate(template: string, data: any): string {
        // Replace {{{ variable }}} with raw HTML (no escaping)
        // MUST be done before double braces to avoid conflict
        template = template.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (match, key) => {
            return data[key] ?? '';
        });

        // Replace {{ variable }} with escaped HTML
        template = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
            return this.escapeHtml(data[key] ?? '');
        });

        return template;
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * Helper: Format time ago
     */
    timeAgo(timestamp: number): string {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";

        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";

        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";

        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";

        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";

        return Math.floor(seconds) + "s ago";
    }

    /**
     * Helper: Get status badge class
     */
    getStatusClass(statusCode: number): string {
        if (statusCode >= 500) return 'bg-red-100 text-red-700';
        if (statusCode >= 400) return 'bg-yellow-100 text-yellow-700';
        if (statusCode >= 300) return 'bg-blue-100 text-blue-700';
        return 'bg-green-100 text-green-700';
    }

    /**
     * Helper: Get method badge class
     */
    getMethodBadge(method: string): string {
        const badges: Record<string, string> = {
            'GET': 'bg-blue-100 text-blue-800',
            'POST': 'bg-green-100 text-green-800',
            'PUT': 'bg-orange-100 text-orange-800',
            'PATCH': 'bg-yellow-100 text-yellow-800',
            'DELETE': 'bg-red-100 text-red-800',
        };
        return badges[method] || 'bg-gray-100 text-gray-800';
    }

    /**
     * Helper: Get database badge
     */
    getDatabaseBadge(database: string): string {
        if (database === 'mongodb') {
            return '<span class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">MongoDB</span>';
        }
        if (database === 'mysql') {
            return '<span class="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">MySQL</span>';
        }
        return '<span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">PostgreSQL</span>';
    }

    /**
     * Helper: Get log level color
     */
    getLogLevelColor(level: string): string {
        if (level === 'error') return 'text-red-700 bg-red-50 ring-red-600/20';
        if (level === 'warn') return 'text-yellow-800 bg-yellow-50 ring-yellow-600/20';
        return 'text-gray-600 bg-gray-50 ring-gray-500/10';
    }
}

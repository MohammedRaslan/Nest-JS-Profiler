export declare class ViewService {
    private readonly viewsPath;
    constructor();
    exists(viewName: string): boolean;
    render(viewName: string, data?: any): string;
    renderWithLayout(title: string, content: string, activeTab?: string): string;
    private loadTemplate;
    private interpolate;
    private escapeHtml;
    timeAgo(timestamp: number): string;
    getStatusClass(statusCode: number): string;
    getMethodBadge(method: string): string;
    getDatabaseBadge(database: string): string;
    getLogLevelColor(level: string): string;
    getCacheOperationBadge(op: string): string;
    getCacheResultBadge(result: string): string;
}

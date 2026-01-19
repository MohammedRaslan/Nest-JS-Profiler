export interface QueryProfile {
    sql: string;
    query?: string;
    database?: 'postgres' | 'mongodb' | 'mysql';
    operation?: string;
    filter?: any;
    params?: any[];
    duration: number;
    startTime: number;
    rowCount?: number;
    error?: string;
    explainPlan?: any;
    connection?: string;
}
export interface LogProfile {
    level: string;
    message: string;
    context?: string;
    timestamp: number;
}
export interface RequestProfile {
    id: string;
    method: string;
    url: string;
    route?: string;
    controller?: string;
    handler?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    statusCode?: number;
    memory?: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
    };
    queries: QueryProfile[];
    logs: LogProfile[];
    timestamp: number;
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    exception?: {
        message: string;
        stack: string;
    };
    timings?: {
        total: number;
        middleware: number;
        handler: number;
    };
}

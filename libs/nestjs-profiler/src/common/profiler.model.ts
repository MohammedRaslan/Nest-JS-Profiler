export interface QueryProfile {
    sql: string;
    query?: string;
    database?: 'postgres' | 'mongodb' | 'mysql';
    operation?: string;
    filter?: any;
    params?: any[];
    duration: number; // ms
    startTime: number;
    rowCount?: number;
    error?: string;
    explainPlan?: any;
    connection?: string;
    tags?: string[];
    duplicatedCount?: number;
    planType?: string;
}

export interface LogProfile {
    level: string;
    message: string;
    context?: string;
    timestamp: number;
}

export interface CacheProfile {
    key: string;
    store: string;
    operation: 'get' | 'set' | 'del' | 'reset' | 'unknown';
    result: 'hit' | 'miss' | 'success' | 'fail' | null;
    ttl?: number;
    duration: number; // ms
    startTime: number;
    value?: any;
}

export interface HttpCallProfile {
    method: string;           // GET, POST, etc.
    url: string;              // full URL
    host: string;
    path: string;
    statusCode?: number;
    duration: number;         // ms
    startTime: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    error?: string;
    protocol: 'http' | 'https';
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
    cache?: CacheProfile[];
    httpCalls?: HttpCallProfile[];
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

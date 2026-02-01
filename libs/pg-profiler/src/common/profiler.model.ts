export interface QueryProfile {
    sql: string; // For PostgreSQL or general query text
    query?: string; // Alias for sql, used for MongoDB JSON representation
    database?: 'postgres' | 'mongodb' | 'mysql'; // Database type
    operation?: string; // MongoDB operation type: 'find', 'insertOne', 'updateMany', etc.
    filter?: any; // MongoDB query filter
    params?: any[];
    duration: number; // ms
    startTime: number;
    rowCount?: number;
    error?: string;
    explainPlan?: any;
    connection?: string; // e.g., "mydb@localhost" or "mydb@localhost:27017"
    tags?: string[]; // e.g. 'slow', 'n+1', 'seq-scan'
    duplicatedCount?: number; // How many times this identical query was run
    planType?: string; // e.g. 'Seq Scan', 'Index Scan', 'COLLSCAN'
}

export interface LogProfile {
    level: string;
    message: string;
    context?: string;
    timestamp: number;
}

export interface CacheProfile {
    key: string;
    store: string; // e.g., 'redis', 'memory'
    operation: 'get' | 'set' | 'del' | 'reset' | 'unknown';
    result: 'hit' | 'miss' | 'success' | 'fail' | null;
    ttl?: number;
    duration: number; // ms
    startTime: number;
    value?: any; // Value metadata or masked value
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
    timestamp: number;
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    exception?: {
        message: string;
        stack: string;
    };
    timings?: {
        total: number;
        middleware: number; // Time from T0 to Interceptor
        handler: number; // Time from Interceptor to End
    };
}

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
  method: string; // GET, POST, etc.
  url: string; // full URL
  host: string;
  path: string;
  statusCode?: number;
  duration: number; // ms
  startTime: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  error?: string;
  protocol: 'http' | 'https';
}

export interface EventListenerTrace {
  name: string; // method/function name e.g. "InventoryListener.onOrderCreated"
  duration: number; // ms
  startTime: number;
  status: 'success' | 'error';
  error?: string;
  file?: string; // source file path e.g. "/src/inventory/inventory.listener.ts"
}

export interface EventProfile {
  id: string;
  eventName: string;
  payloadPreview: string; // JSON.stringify truncated to 200 chars
  emittedAt: number;
  isAsync: boolean;
  emitterLocation: string; // parsed from call stack, e.g. "DemoController.fireOrderCreated"
  emitterFile: string;     // file:line where the event was emitted, e.g. "/src/demo/demo.controller.ts:29"
  listeners: EventListenerTrace[];
  totalDuration: number; // ms from emit to all listeners done
  status: 'pending' | 'success' | 'error';
  error?: string;
  parentEventId?: string; // set when emitted from inside a listener
  requestId?: string; // linked request profile id
  depth: number; // 0 = root, 1 = emitted by a listener, etc.
  childEventIds: string[];
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

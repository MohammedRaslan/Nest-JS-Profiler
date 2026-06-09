import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import type * as http from 'http';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import { ProfilerService } from '../services/profiler.service';
import { HttpCallProfile } from '../common/profiler.model';

// Internal marker so we skip self-issued SSE/profiler requests
const PROFILER_INTERNAL_HEADER = 'x-profiler-internal';

@Injectable()
export class HttpCollector implements OnModuleInit {
    private readonly logger = new Logger(HttpCollector.name);

    constructor(
        private readonly profiler: ProfilerService,
        @Inject('PROFILER_OPTIONS') private readonly options: ProfilerOptions,
    ) { }

    onModuleInit() {
        if (this.options.collectHttp === false) return;

        const httpMod = require('http');
        const httpsMod = require('https');

        this.patchModule(httpMod, 'http');
        this.patchModule(httpsMod, 'https');
        this.logger.log('HTTP/HTTPS outbound request tracking enabled');
    }

    private patchModule(mod: any, protocol: 'http' | 'https') {
        if (mod.__profilerPatched) return;
        mod.__profilerPatched = true;

        const self = this;
        const originalRequest = mod.request.bind(mod);
        const originalGet = mod.get.bind(mod);

        mod.request = function (...args: any[]): http.ClientRequest {
            const startTime = Date.now();

            let method = 'GET';
            let host = '';
            let path = '/';
            let fullUrl = '';
            let reqHeaders: Record<string, any> = {};

            try {
                const first = args[0];
                if (typeof first === 'string' || first instanceof URL) {
                    const u = typeof first === 'string' ? new URL(first) : first;
                    host = u.hostname + (u.port ? `:${u.port}` : '');
                    path = u.pathname + u.search;
                    fullUrl = u.toString();
                    const opts = (args[1] && typeof args[1] === 'object' && typeof args[1] !== 'function') ? args[1] : {};
                    method = (opts?.method || 'GET').toUpperCase();
                    reqHeaders = opts?.headers || {};
                } else if (first && typeof first === 'object') {
                    method = (first.method || 'GET').toUpperCase();
                    host = first.hostname || first.host || 'localhost';
                    if (first.port && !String(host).includes(':')) host += `:${first.port}`;
                    path = first.path || '/';
                    const defaultPort = protocol === 'https' ? 443 : 80;
                    const portStr = first.port && first.port !== defaultPort ? `:${first.port}` : '';
                    fullUrl = `${protocol}://${first.hostname || first.host || 'localhost'}${portStr}${path}`;
                    reqHeaders = first.headers || {};
                }
            } catch (_) { /* best-effort parsing */ }

            if (reqHeaders[PROFILER_INTERNAL_HEADER] || fullUrl.includes('/__profiler')) {
                return originalRequest(...args);
            }

            const profile = self.profiler.getCurrentProfile();

            const req: http.ClientRequest = originalRequest(...args);

            if (profile) {
                const httpCall: HttpCallProfile = {
                    method,
                    url: fullUrl,
                    host,
                    path,
                    protocol,
                    startTime,
                    duration: 0,
                    requestHeaders: self.sanitiseHeaders(reqHeaders),
                };

                req.on('response', (res: http.IncomingMessage) => {
                    httpCall.statusCode = res.statusCode;
                    httpCall.responseHeaders = self.sanitiseHeaders(res.headers as any);

                    res.on('end', () => {
                        httpCall.duration = Date.now() - startTime;
                        self.profiler.addHttpCall(httpCall);
                    });

                    res.resume();
                });

                req.on('error', (err: Error) => {
                    httpCall.duration = Date.now() - startTime;
                    httpCall.error = err.message;
                    self.profiler.addHttpCall(httpCall);
                });
            }

            return req;
        };

        mod.get = function (...args: any[]): http.ClientRequest {
            const req = mod.request(...args);
            req.end();
            return req;
        };
    }

    private sanitiseHeaders(headers: Record<string, any>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(headers || {})) {
            const lower = k.toLowerCase();
            if (lower === 'authorization' || lower === 'cookie' || lower === 'set-cookie') {
                result[k] = '[redacted]';
            } else {
                result[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
            }
        }
        return result;
    }
}

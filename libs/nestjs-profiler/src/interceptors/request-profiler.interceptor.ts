import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ProfilerService } from '../services/profiler.service';

@Injectable()
export class RequestProfilerInterceptor implements NestInterceptor {
    private logger = new Logger(RequestProfilerInterceptor.name);

    constructor(private profiler: ProfilerService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();

        if (process.env.PROFILER_DEBUG) {
            this.logger.debug(`Starting profile for ${req.method} ${req.url}`);
        }

        if (!req || !res || req.url.startsWith('/__profiler') || req.url.includes('favicon.ico') || req.method === 'OPTIONS') {
            return next.handle();
        }

        // Prevent duplicate profiling for the same request (e.g. if interceptor is global + controller scoped)
        if ((req as any)._profilerAttached) {
            return next.handle();
        }
        (req as any)._profilerAttached = true;

        const interceptorStartTime = Date.now();
        const middlewareStartTime = (req as any)._profilerT0 || interceptorStartTime;

        const profile = this.profiler.startRequest();

        if (profile) {
            profile.method = req.method;
            profile.url = req.originalUrl || req.url;
            profile.controller = context.getClass().name;
            profile.handler = context.getHandler().name;
            profile.requestHeaders = this.sanitizeHeaders(req.headers);
            profile.requestBody = req.body;
        }

        return next.handle().pipe(
            tap({
                next: () => {
                    if (profile) {
                        profile.statusCode = res.statusCode;
                        this.finishProfile(profile, interceptorStartTime, middlewareStartTime);
                    }
                },
                error: (err) => {
                    if (profile) {
                        const status = err.status || err.statusCode || 500;
                        profile.statusCode = status;

                        profile.exception = {
                            message: err.message,
                            stack: err.stack
                        };

                        profile.queries.push({
                            sql: 'ERROR_CONTEXT',
                            duration: 0,
                            startTime: Date.now(),
                            error: err.message,
                            database: 'postgres',
                        });
                        this.finishProfile(profile, interceptorStartTime, middlewareStartTime);
                    }
                },
            }),
        );
    }

    private finishProfile(profile: any, interceptorStartTime: number, middlewareStartTime: number) {
        const endTime = Date.now();
        const totalDuration = endTime - middlewareStartTime;
        const middlewareDuration = interceptorStartTime - middlewareStartTime;
        const handlerDuration = endTime - interceptorStartTime;

        profile.timings = {
            total: totalDuration,
            middleware: Math.max(0, middlewareDuration),
            handler: Math.max(0, handlerDuration)
        };

        profile.duration = totalDuration;

        this.profiler.endRequest(profile);
    }

    private sanitizeHeaders(headers: any): any {
        const sanitized = { ...headers };
        const sensitive = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

        sensitive.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '*** MASKED ***';
            }
        });

        return sanitized;
    }
}

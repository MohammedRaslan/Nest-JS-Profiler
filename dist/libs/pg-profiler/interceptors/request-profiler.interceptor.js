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
var RequestProfilerInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestProfilerInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const profiler_service_1 = require("../services/profiler.service");
let RequestProfilerInterceptor = RequestProfilerInterceptor_1 = class RequestProfilerInterceptor {
    profiler;
    logger = new common_1.Logger(RequestProfilerInterceptor_1.name);
    constructor(profiler) {
        this.profiler = profiler;
    }
    intercept(context, next) {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        if (process.env.PROFILER_DEBUG) {
            this.logger.debug(`Starting profile for ${req.method} ${req.url}`);
        }
        if (!req || !res || req.url.startsWith('/__profiler') || req.url.includes('favicon.ico') || req.method === 'OPTIONS') {
            return next.handle();
        }
        if (req._profilerAttached) {
            return next.handle();
        }
        req._profilerAttached = true;
        const interceptorStartTime = Date.now();
        const middlewareStartTime = req._profilerT0 || interceptorStartTime;
        const profile = this.profiler.startRequest();
        if (profile) {
            profile.method = req.method;
            profile.url = req.originalUrl || req.url;
            profile.controller = context.getClass().name;
            profile.handler = context.getHandler().name;
            profile.requestHeaders = this.sanitizeHeaders(req.headers);
            profile.requestBody = req.body;
        }
        return next.handle().pipe((0, operators_1.tap)({
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
        }));
    }
    finishProfile(profile, interceptorStartTime, middlewareStartTime) {
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
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitive = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
        sensitive.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '*** MASKED ***';
            }
        });
        return sanitized;
    }
};
exports.RequestProfilerInterceptor = RequestProfilerInterceptor;
exports.RequestProfilerInterceptor = RequestProfilerInterceptor = RequestProfilerInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService])
], RequestProfilerInterceptor);
//# sourceMappingURL=request-profiler.interceptor.js.map
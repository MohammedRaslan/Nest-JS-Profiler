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
exports.ProfilerLogger = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("./services/profiler.service");
let ProfilerLogger = class ProfilerLogger extends common_1.ConsoleLogger {
    profiler;
    constructor(profiler) {
        super();
        this.profiler = profiler;
    }
    log(message, ...optionalParams) {
        super.log(message, ...optionalParams);
        this.captureLog('log', message, optionalParams);
    }
    error(message, ...optionalParams) {
        super.error(message, ...optionalParams);
        this.captureLog('error', message, optionalParams);
    }
    warn(message, ...optionalParams) {
        super.warn(message, ...optionalParams);
        this.captureLog('warn', message, optionalParams);
    }
    debug(message, ...optionalParams) {
        super.debug(message, ...optionalParams);
        this.captureLog('debug', message, optionalParams);
    }
    verbose(message, ...optionalParams) {
        super.verbose(message, ...optionalParams);
        this.captureLog('verbose', message, optionalParams);
    }
    captureLog(level, message, params) {
        try {
            const context = params.length > 0 ? params[params.length - 1] : undefined;
            const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
            this.profiler.addLog({
                level,
                message: msgStr,
                context: typeof context === 'string' ? context : undefined,
                timestamp: Date.now()
            });
        }
        catch (e) {
        }
    }
};
exports.ProfilerLogger = ProfilerLogger;
exports.ProfilerLogger = ProfilerLogger = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.TRANSIENT }),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService])
], ProfilerLogger);
//# sourceMappingURL=profiler-logger.js.map
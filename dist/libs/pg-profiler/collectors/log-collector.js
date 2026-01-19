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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LogCollector_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogCollector = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("../services/profiler.service");
let LogCollector = LogCollector_1 = class LogCollector {
    profiler;
    options;
    logger = new common_1.Logger(LogCollector_1.name);
    constructor(profiler, options) {
        this.profiler = profiler;
        this.options = options;
    }
    onModuleInit() {
        if (this.options.collectLogs === false) {
            return;
        }
        this.patchProcessStream('stdout');
        this.patchProcessStream('stderr');
        this.logger.log('LogCollector initialized: Patching process.stdout/stderr');
    }
    patchProcessStream(streamName) {
        const stream = process[streamName];
        const originalWrite = stream.write;
        const self = this;
        stream.write = function (chunk, encodingOrCb, cb) {
            const result = originalWrite.apply(this, arguments);
            try {
                const msg = chunk.toString();
                if (msg.includes('[LogCollector]'))
                    return result;
                self.capture(streamName === 'stderr' ? 'error' : 'log', msg);
            }
            catch (e) {
            }
            return result;
        };
    }
    capture(level, message) {
        if (!message.trim())
            return;
        this.profiler.addLog({
            level,
            message: message.trim(),
            timestamp: Date.now()
        });
    }
};
exports.LogCollector = LogCollector;
exports.LogCollector = LogCollector = LogCollector_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('PROFILER_OPTIONS')),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService, Object])
], LogCollector);
//# sourceMappingURL=log-collector.js.map
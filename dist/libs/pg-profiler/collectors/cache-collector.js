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
var CacheCollector_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheCollector = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("../services/profiler.service");
let CacheCollector = CacheCollector_1 = class CacheCollector {
    profiler;
    options;
    cacheManager;
    logger = new common_1.Logger(CacheCollector_1.name);
    constructor(profiler, options, cacheManager) {
        this.profiler = profiler;
        this.options = options;
        this.cacheManager = cacheManager;
    }
    onModuleInit() {
        if (this.options.collectCache === false) {
            return;
        }
        if (!this.cacheManager) {
            this.logger.warn('No CACHE_MANAGER found, skipping Cache profiling. Ensure CacheModule is imported globally or available to ProfilerModule.');
            return;
        }
        this.logger.log('CacheCollector initialized: Wrapping CACHE_MANAGER');
        this.wrapCacheManager();
    }
    wrapCacheManager() {
        const self = this;
        const cm = this.cacheManager;
        this.logger.log(`CacheCollector: Inspecting CacheManager keys: ${Object.keys(cm)}`);
        const originalGet = cm.get;
        if (originalGet) {
            this.logger.log('CacheCollector: Wrapping "get" method');
            cm.get = async function (...args) {
                const startTime = Date.now();
                const key = args[0];
                try {
                    const result = await originalGet.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('get', key, result !== undefined && result !== null ? 'hit' : 'miss', startTime, endTime);
                    return result;
                }
                catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('get', key, 'fail', startTime, endTime);
                    throw error;
                }
            };
        }
        else {
            this.logger.warn('CacheCollector: "get" method not found on CacheManager');
        }
        if (cm.store && cm.store.get) {
            this.logger.log('CacheCollector: Underlying store found: ' + (cm.store.name || cm.store.constructor?.name));
        }
        const originalSet = cm.set;
        if (originalSet) {
            this.logger.log('CacheCollector: Wrapping "set" method');
            cm.set = async function (...args) {
                const startTime = Date.now();
                const key = args[0];
                const ttl = args[2];
                try {
                    const result = await originalSet.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('set', key, 'success', startTime, endTime, ttl);
                    return result;
                }
                catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('set', key, 'fail', startTime, endTime);
                    throw error;
                }
            };
        }
        else {
            this.logger.warn('CacheCollector: "set" method not found on CacheManager');
        }
        const originalDel = cm.del;
        if (originalDel) {
            cm.del = async function (...args) {
                const startTime = Date.now();
                const key = args[0];
                try {
                    const result = await originalDel.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('del', key, 'success', startTime, endTime);
                    return result;
                }
                catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('del', key, 'fail', startTime, endTime);
                    throw error;
                }
            };
        }
        const originalReset = cm.reset;
        if (originalReset) {
            cm.reset = async function (...args) {
                const startTime = Date.now();
                try {
                    const result = await originalReset.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('reset', '*', 'success', startTime, endTime);
                    return result;
                }
                catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('reset', '*', 'fail', startTime, endTime);
                    throw error;
                }
            };
        }
    }
    captureOperation(operation, key, result, startTime, endTime, ttl) {
        try {
            let storeName = 'unknown';
            const cm = this.cacheManager;
            if (cm.store) {
                if (cm.store.name)
                    storeName = cm.store.name;
                else if (cm.store.constructor && cm.store.constructor.name)
                    storeName = cm.store.constructor.name;
            }
            const profile = {
                key: String(key),
                store: storeName,
                operation,
                result,
                ttl,
                duration: endTime - startTime,
                startTime,
            };
            this.logger.debug(`CacheCollector: Captured ${operation} on ${key}. Duration: ${profile.duration}ms`);
            this.profiler.addCache(profile);
        }
        catch (e) {
            this.logger.error('Error capturing cache operation', e);
        }
    }
};
exports.CacheCollector = CacheCollector;
exports.CacheCollector = CacheCollector = CacheCollector_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('PROFILER_OPTIONS')),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)('CACHE_MANAGER')),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService, Object, Object])
], CacheCollector);
//# sourceMappingURL=cache-collector.js.map
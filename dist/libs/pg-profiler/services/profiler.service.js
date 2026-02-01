"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProfilerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilerService = void 0;
const common_1 = require("@nestjs/common");
const async_hooks_1 = require("async_hooks");
const crypto = __importStar(require("crypto"));
let ProfilerService = ProfilerService_1 = class ProfilerService {
    options;
    storage;
    als = new async_hooks_1.AsyncLocalStorage();
    logger = new common_1.Logger(ProfilerService_1.name);
    constructor(options, storage) {
        this.options = options;
        this.storage = storage;
    }
    isEnabled() {
        return this.options.enabled !== false;
    }
    startRequest() {
        if (!this.isEnabled())
            return null;
        if (this.als.getStore()) {
            return null;
        }
        const profile = {
            id: crypto.randomUUID(),
            method: '',
            url: '',
            startTime: Date.now(),
            queries: [],
            logs: [],
            cache: [],
            timestamp: Date.now(),
        };
        this.als.enterWith(profile);
        return profile;
    }
    endRequest(profile) {
        if (!profile)
            return;
        profile.endTime = Date.now();
        profile.duration = profile.endTime - profile.startTime;
        profile.memory = process.memoryUsage();
        this.analyzeRequest(profile);
        this.storage.save(profile);
    }
    analyzeRequest(profile) {
        if (!profile.queries || profile.queries.length === 0)
            return;
        const queryGroups = new Map();
        profile.queries.forEach((q, index) => {
            const fingerprint = q.sql || q.query || 'unknown';
            if (!queryGroups.has(fingerprint)) {
                queryGroups.set(fingerprint, { count: 0, indices: [] });
            }
            const group = queryGroups.get(fingerprint);
            group.count++;
            group.indices.push(index);
            if (q.duration > 100) {
                this.addTag(q, 'slow');
            }
        });
        queryGroups.forEach((group) => {
            if (group.count > 1) {
                group.indices.forEach(index => {
                    const q = profile.queries[index];
                    q.duplicatedCount = group.count;
                    this.addTag(q, 'n+1');
                });
            }
        });
    }
    addTag(query, tag) {
        if (!query.tags)
            query.tags = [];
        if (!query.tags.includes(tag)) {
            query.tags.push(tag);
        }
    }
    addQuery(query) {
        const profile = this.als.getStore();
        if (profile) {
            profile.queries.push(query);
            this.storage.save(profile);
        }
    }
    addLog(log) {
        const profile = this.als.getStore();
        if (profile) {
            profile.logs.push(log);
            this.storage.save(profile);
        }
    }
    addCache(cacheProfile) {
        const profile = this.als.getStore();
        if (profile) {
            if (!profile.cache)
                profile.cache = [];
            profile.cache.push(cacheProfile);
            this.storage.save(profile);
        }
        else {
            this.logger.debug(`Profiler: Skipping cache capture for ${cacheProfile.key} - No active request context (ALS is empty).`);
        }
    }
    getCurrentProfile() {
        return this.als.getStore();
    }
    async getDashboardData() {
        return Promise.resolve(this.storage.all());
    }
    async getProfileDetail(id) {
        return Promise.resolve(this.storage.get(id));
    }
    async getQueriesList() {
        const profiles = await Promise.resolve(this.storage.all());
        const allQueries = profiles.flatMap(p => (p.queries || []).map(q => ({
            ...q,
            requestId: p.id,
            requestUrl: p.url,
            requestMethod: p.method
        })));
        allQueries.sort((a, b) => b.startTime - a.startTime);
        return allQueries;
    }
    async getLogsList(page = 1, pageSize = 50) {
        const pageNum = Math.max(1, Number(page) || 1);
        const profiles = await Promise.resolve(this.storage.all());
        const allLogs = profiles.flatMap(p => (p.logs || []).map(l => ({
            ...l,
            requestId: p.id,
            requestUrl: p.url,
            requestMethod: p.method
        })));
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        const totalLogs = allLogs.length;
        const totalPages = Math.ceil(totalLogs / pageSize);
        const startIndex = (pageNum - 1) * pageSize;
        const pagedLogs = allLogs.slice(startIndex, startIndex + pageSize);
        return {
            logs: pagedLogs,
            currentPage: pageNum,
            totalPages,
            totalLogs
        };
    }
    async getAllProfilesJson() {
        return this.storage.all();
    }
    async getProfileJson(id) {
        return Promise.resolve(this.storage.get(id));
    }
    async getCacheList() {
        const profiles = await Promise.resolve(this.storage.all());
        const allOps = profiles.flatMap(p => (p.cache || []).map(c => ({
            ...c,
            requestId: p.id,
            requestUrl: p.url,
            requestMethod: p.method
        })));
        allOps.sort((a, b) => b.startTime - a.startTime);
        return allOps;
    }
};
exports.ProfilerService = ProfilerService;
exports.ProfilerService = ProfilerService = ProfilerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('PROFILER_OPTIONS')),
    __param(1, (0, common_1.Inject)('PROFILER_STORAGE')),
    __metadata("design:paramtypes", [Object, Object])
], ProfilerService);
//# sourceMappingURL=profiler.service.js.map
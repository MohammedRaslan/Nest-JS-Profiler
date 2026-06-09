import { Injectable, Inject, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { EventEmitter } from 'events';
import { RequestProfile, QueryProfile, LogProfile, HttpCallProfile } from '../common/profiler.model';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import type { ProfilerStorage } from '../storage/profiler-storage.interface';
import * as crypto from 'crypto';

@Injectable()
export class ProfilerService {
    private readonly als = new AsyncLocalStorage<RequestProfile>();
    private readonly logger = new Logger(ProfilerService.name);
    readonly logEmitter = new EventEmitter();

    constructor(
        @Inject('PROFILER_OPTIONS') private options: ProfilerOptions,
        @Inject('PROFILER_STORAGE') private storage: ProfilerStorage,
    ) { }

    isEnabled(): boolean {
        return this.options.enabled !== false;
    }

    startRequest(): RequestProfile | null {
        if (!this.isEnabled()) return null;

        // Prevent nested profiling (if already in a profiling context)
        if (this.als.getStore()) {
            return null;
        }

        const profile: RequestProfile = {
            id: crypto.randomUUID(),
            method: '',
            url: '',
            startTime: Date.now(),
            queries: [],
            logs: [],
            cache: [],
            httpCalls: [],
            timestamp: Date.now(),
        };

        this.als.enterWith(profile);
        return profile;
    }

    endRequest(profile: RequestProfile) {
        if (!profile) return;

        profile.endTime = Date.now();
        profile.duration = profile.endTime - profile.startTime;
        profile.memory = process.memoryUsage();

        this.analyzeRequest(profile);

        this.storage.save(profile);
    }

    private analyzeRequest(profile: RequestProfile) {
        if (!profile.queries || profile.queries.length === 0) return;

        const queryGroups = new Map<string, { count: number, indices: number[] }>();

        // 1. Group queries to find N+1
        profile.queries.forEach((q, index) => {
            // Simple normalization: Use the SQL/Query string as the fingerprint
            // For better accuracy, we might want to mask literals, but exact match is a good start for N+1 loops
            const fingerprint = q.sql || q.query || 'unknown';

            if (!queryGroups.has(fingerprint)) {
                queryGroups.set(fingerprint, { count: 0, indices: [] });
            }
            const group = queryGroups.get(fingerprint);
            group!.count++;
            group!.indices.push(index);

            // 2. Tag Slow Queries (> 100ms)
            if (q.duration > 100) {
                this.addTag(q, 'slow');
            }
        });

        // 3. Mark N+1
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

    private addTag(query: QueryProfile, tag: string) {
        if (!query.tags) query.tags = [];
        if (!query.tags.includes(tag)) {
            query.tags.push(tag);
        }
    }

    addQuery(query: QueryProfile) {
        // The original addQuery had checks for isEnabled() and collectQueries.
        // The instruction's snippet for addQuery removes these checks and adds storage.save().
        // Assuming the intent is to simplify and always add/save if a profile exists.
        const profile = this.als.getStore();
        if (profile) {
            profile.queries.push(query);
            this.storage.save(profile); // Update storage
        }
    }

    addLog(log: LogProfile) {
        // Always broadcast to live SSE clients, regardless of active request context
        this.logEmitter.emit('log', log);

        const profile = this.als.getStore();
        if (profile) {
            profile.logs.push(log);
            this.storage.save(profile);
        }
    }

    addCache(cacheProfile: import('../common/profiler.model').CacheProfile) {
        const profile = this.als.getStore();
        if (profile) {
            if (!profile.cache) profile.cache = [];
            profile.cache.push(cacheProfile);
            this.storage.save(profile);
        } else {
            // If we are developing/debugging, we might want to know this. 
            // In production this would be spammy, but for now it's crucial.
            this.logger.debug(`Profiler: Skipping cache capture for ${cacheProfile.key} - No active request context (ALS is empty).`);
        }
    }

    addHttpCall(call: HttpCallProfile) {
        const profile = this.als.getStore();
        if (profile) {
            if (!profile.httpCalls) profile.httpCalls = [];
            profile.httpCalls.push(call);
            this.storage.save(profile);
        }
    }

    getCurrentProfile(): RequestProfile | undefined {
        return this.als.getStore();
    }

    // ==================== Business Logic Methods ====================

    /**
     * Get all profiles for dashboard
     */
    async getDashboardData(): Promise<RequestProfile[]> {
        return Promise.resolve(this.storage.all());
    }

    /**
     * Get profile detail by ID
     */
    async getProfileDetail(id: string): Promise<RequestProfile | null> {
        return Promise.resolve(this.storage.get(id));
    }

    /**
     * Get all queries across all profiles
     */
    async getQueriesList(): Promise<any[]> {
        const profiles = await Promise.resolve(this.storage.all());
        const allQueries = profiles.flatMap(p =>
            (p.queries || []).map(q => ({
                ...q,
                requestId: p.id,
                requestUrl: p.url,
                requestMethod: p.method
            }))
        );

        // Sort duration descending (longest first)
        allQueries.sort((a, b) => b.duration - a.duration);

        return allQueries;
    }

    /**
     * Get paginated logs
     */
    async getLogsList(page: number = 1, pageSize: number = 50): Promise<{
        logs: any[];
        currentPage: number;
        totalPages: number;
        totalLogs: number;
    }> {
        const pageNum = Math.max(1, Number(page) || 1);

        const profiles = await Promise.resolve(this.storage.all());
        const allLogs = profiles.flatMap(p =>
            (p.logs || []).map(l => ({
                ...l,
                requestId: p.id,
                requestUrl: p.url,
                requestMethod: p.method
            }))
        );

        // Sort newest first
        allLogs.sort((a, b) => b.timestamp - a.timestamp);

        // Pagination
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

    /**
     * Get all profiles as JSON
     */
    async getAllProfilesJson(): Promise<RequestProfile[]> {
        return this.storage.all();
    }

    /**
     * Get profile by ID as JSON
     */
    async getProfileJson(id: string): Promise<RequestProfile | null> {
        return Promise.resolve(this.storage.get(id));
    }

    /**
     * Compute aggregate summary statistics across all captured profiles
     */
    async getSummaryStats(): Promise<{
        totalRequests: number;
        avgDuration: number;
        p95Duration: number;
        errorRate: number;
        totalQueries: number;
        slowQueries: number;
        nPlusOneCount: number;
        seqScanCount: number;
        cacheHitRate: number;
        totalCacheOps: number;
        methodDistribution: Record<string, number>;
        statusDistribution: Record<string, number>;
        topSlowEndpoints: { route: string; method: string; avgDuration: number; callCount: number }[];
        topSlowQueries: { sql: string; duration: number; requestUrl: string }[];
        recentErrors: { id: string; url: string; method: string; statusCode: number; message: string; timestamp: number }[];
        memoryUsage: { rss: number; heapUsed: number; heapTotal: number } | null;
    }> {
        const profiles = await Promise.resolve(this.storage.all());

        if (profiles.length === 0) {
            return {
                totalRequests: 0, avgDuration: 0, p95Duration: 0, errorRate: 0,
                totalQueries: 0, slowQueries: 0, nPlusOneCount: 0, seqScanCount: 0,
                cacheHitRate: 0, totalCacheOps: 0,
                methodDistribution: {}, statusDistribution: {},
                topSlowEndpoints: [], topSlowQueries: [], recentErrors: [],
                memoryUsage: null,
            };
        }

        // Basic request stats
        const durations = profiles.map(p => p.duration || 0).sort((a, b) => a - b);
        const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length;
        const p95Duration = durations[Math.floor(durations.length * 0.95)] ?? durations[durations.length - 1];

        const errorProfiles = profiles.filter(p => p.statusCode && p.statusCode >= 400);
        const errorRate = (errorProfiles.length / profiles.length) * 100;

        // Query stats
        const allQueries = profiles.flatMap(p => p.queries || []);
        const slowQueries = allQueries.filter(q => q.duration > 100).length;
        const nPlusOneCount = allQueries.filter(q => q.tags?.includes('n+1')).length;
        const seqScanCount = allQueries.filter(q => q.tags?.includes('seq-scan')).length;

        // Cache stats
        const allCacheOps = profiles.flatMap(p => p.cache || []);
        const cacheHits = allCacheOps.filter(c => c.result === 'hit').length;
        const cacheGets = allCacheOps.filter(c => c.operation === 'get').length;
        const cacheHitRate = cacheGets > 0 ? (cacheHits / cacheGets) * 100 : 0;

        // Method distribution
        const methodDistribution: Record<string, number> = {};
        profiles.forEach(p => {
            const m = p.method || 'UNKNOWN';
            methodDistribution[m] = (methodDistribution[m] || 0) + 1;
        });

        // Status distribution (grouped: 2xx, 3xx, 4xx, 5xx)
        const statusDistribution: Record<string, number> = {};
        profiles.forEach(p => {
            const code = p.statusCode || 0;
            const bucket = code >= 500 ? '5xx' : code >= 400 ? '4xx' : code >= 300 ? '3xx' : code >= 200 ? '2xx' : 'unknown';
            statusDistribution[bucket] = (statusDistribution[bucket] || 0) + 1;
        });

        // Top slow endpoints (group by route or url)
        const endpointMap = new Map<string, { durations: number[]; method: string }>();
        profiles.forEach(p => {
            const key = `${p.method}:${p.route || p.url}`;
            if (!endpointMap.has(key)) endpointMap.set(key, { durations: [], method: p.method });
            endpointMap.get(key)!.durations.push(p.duration || 0);
        });
        const topSlowEndpoints = Array.from(endpointMap.entries())
            .map(([key, val]) => ({
                route: key.split(':').slice(1).join(':'),
                method: val.method,
                avgDuration: val.durations.reduce((s, d) => s + d, 0) / val.durations.length,
                callCount: val.durations.length,
            }))
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, 5);

        // Top slow queries
        const topSlowQueries = [...allQueries]
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)
            .map(q => {
                const parent = profiles.find(p => p.queries.includes(q));
                return { sql: q.sql || q.query || '', duration: q.duration, requestUrl: parent?.url || '' };
            });

        // Recent errors
        const recentErrors = errorProfiles
            .slice(0, 5)
            .map(p => ({
                id: p.id,
                url: p.url,
                method: p.method,
                statusCode: p.statusCode || 0,
                message: p.exception?.message || '',
                timestamp: p.timestamp,
            }));

        // Latest memory snapshot
        const latestWithMemory = [...profiles].find(p => p.memory);
        const memoryUsage = latestWithMemory?.memory
            ? {
                rss: Math.round(latestWithMemory.memory.rss / 1024 / 1024),
                heapUsed: Math.round(latestWithMemory.memory.heapUsed / 1024 / 1024),
                heapTotal: Math.round(latestWithMemory.memory.heapTotal / 1024 / 1024),
            }
            : null;

        return {
            totalRequests: profiles.length,
            avgDuration: Math.round(avgDuration),
            p95Duration: Math.round(p95Duration),
            errorRate: Math.round(errorRate * 10) / 10,
            totalQueries: allQueries.length,
            slowQueries,
            nPlusOneCount,
            seqScanCount,
            cacheHitRate: Math.round(cacheHitRate * 10) / 10,
            totalCacheOps: allCacheOps.length,
            methodDistribution,
            statusDistribution,
            topSlowEndpoints,
            topSlowQueries,
            recentErrors,
            memoryUsage,
        };
    }

    /**
     * Get all outbound HTTP calls across all profiles
     */
    async getHttpCallsList(): Promise<any[]> {
        const profiles = await Promise.resolve(this.storage.all());
        const allCalls = profiles.flatMap(p =>
            (p.httpCalls || []).map(c => ({
                ...c,
                requestId: p.id,
                requestUrl: p.url,
                requestMethod: p.method,
            }))
        );
        // Sort slowest first
        allCalls.sort((a, b) => b.duration - a.duration);
        return allCalls;
    }

    /**
     * Get all cache operations
     */
    async getCacheList(): Promise<any[]> {
        const profiles = await Promise.resolve(this.storage.all());
        const allOps = profiles.flatMap(p =>
            (p.cache || []).map(c => ({
                ...c,
                requestId: p.id,
                requestUrl: p.url,
                requestMethod: p.method
            }))
        );

        // Sort newest first
        allOps.sort((a, b) => b.startTime - a.startTime);

        return allOps;
    }
}

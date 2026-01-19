import { Injectable, Inject, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestProfile, QueryProfile, LogProfile } from '../common/profiler.model';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import type { ProfilerStorage } from '../storage/profiler-storage.interface';
import * as crypto from 'crypto';

@Injectable()
export class ProfilerService {
    private readonly als = new AsyncLocalStorage<RequestProfile>();
    private readonly logger = new Logger(ProfilerService.name);

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

        this.storage.save(profile);
        // this.als.disable(); // Do not disable explicitly if it breaks nested flows, but exit is automatic with run/enterWith usually. 
        // Actually enterWith is persistent context for the promise chain.
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
        const profile = this.als.getStore();
        if (profile) {
            profile.logs.push(log);
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

        // Sort newest first
        allQueries.sort((a, b) => b.startTime - a.startTime);

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
}

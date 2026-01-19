import { RequestProfile, QueryProfile, LogProfile } from '../common/profiler.model';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import type { ProfilerStorage } from '../storage/profiler-storage.interface';
export declare class ProfilerService {
    private options;
    private storage;
    private readonly als;
    private readonly logger;
    constructor(options: ProfilerOptions, storage: ProfilerStorage);
    isEnabled(): boolean;
    startRequest(): RequestProfile | null;
    endRequest(profile: RequestProfile): void;
    addQuery(query: QueryProfile): void;
    addLog(log: LogProfile): void;
    getCurrentProfile(): RequestProfile | undefined;
    getDashboardData(): Promise<RequestProfile[]>;
    getProfileDetail(id: string): Promise<RequestProfile | null>;
    getQueriesList(): Promise<any[]>;
    getLogsList(page?: number, pageSize?: number): Promise<{
        logs: any[];
        currentPage: number;
        totalPages: number;
        totalLogs: number;
    }>;
    getAllProfilesJson(): Promise<RequestProfile[]>;
    getProfileJson(id: string): Promise<RequestProfile | null>;
}

import { ProfilerStorage } from '../storage/profiler-storage.interface';
export interface ProfilerExplainOptions {
    enabled?: boolean;
    analyze?: boolean;
    thresholdMs?: number;
}
export type ProfilerStorageType = 'memory' | ProfilerStorage;
export interface ProfilerOptions {
    enabled?: boolean;
    storage?: ProfilerStorageType;
    pgDriver?: any;
    mongoDriver?: any;
    mysqlDriver?: any;
    collectQueries?: boolean;
    collectLogs?: boolean;
    collectMongo?: boolean;
    collectMysql?: boolean;
    explain?: ProfilerExplainOptions;
}

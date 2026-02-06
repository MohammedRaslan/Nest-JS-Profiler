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
    pgDriver?: any; // Manual injection of pg driver
    mongoDriver?: any; // Manual injection of mongodb driver
    mysqlDriver?: any; // Manual injection of mysql2 driver
    collectQueries?: boolean;
    collectLogs?: boolean;
    collectMongo?: boolean; // Enable/disable MongoDB profiling (default: true)
    collectCache?: boolean; // Enable/disable Cache profiling (default: true)
    collectMysql?: boolean; // Enable/disable MySQL profiling (default: true)
    explain?: ProfilerExplainOptions;
}

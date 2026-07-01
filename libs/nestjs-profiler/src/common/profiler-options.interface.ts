import { ProfilerStorage } from '../storage/profiler-storage.interface';

export interface ProfilerExplainOptions {
    enabled?: boolean;
    analyze?: boolean;
    thresholdMs?: number;
}

export type ProfilerStorageType = 'memory' | ProfilerStorage;

/**
 * Discriminated union — TypeScript enforces that username + password
 * are required whenever enabled is true. You cannot pass
 * { enabled: true } without credentials; the compiler will reject it.
 *
 * Usage:
 *   auth: { enabled: false }                                  // auth off (default)
 *   auth: { enabled: true, username: 'admin', password: '…' } // auth on
 */
export type ProfilerAuth =
    | { enabled: false }
    | { enabled: true; username: string; password: string };

export interface ProfilerOptions {
    enabled?: boolean;
    storage?: ProfilerStorageType;
    pgDriver?: any;
    mongoDriver?: any;
    mysqlDriver?: any;
    collectQueries?: boolean;
    collectLogs?: boolean;
    collectMongo?: boolean;
    collectCache?: boolean;
    collectMysql?: boolean;
    collectHttp?: boolean;
    explain?: ProfilerExplainOptions;
    /**
     * Dashboard authentication. Disabled by default.
     * When enabled, all /__profiler routes are protected by a login page.
     */
    auth?: ProfilerAuth;
}

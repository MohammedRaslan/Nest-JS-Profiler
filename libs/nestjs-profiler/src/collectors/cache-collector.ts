import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import { CacheProfile } from '../common/profiler.model';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheCollector implements OnModuleInit {
    private readonly logger = new Logger(CacheCollector.name);

    constructor(
        private readonly profiler: ProfilerService,
        @Inject('PROFILER_OPTIONS') private readonly options: ProfilerOptions,
        // We use the string literal 'CACHE_MANAGER' to avoid a hard runtime dependency on @nestjs/cache-manager
        @Optional() @Inject('CACHE_MANAGER') private readonly cacheManager: Cache
    ) { }

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

    private wrapCacheManager() {
        const self = this;
        // Cast to any to allow monkey-patching methods which might be readonly in the interface
        const cm = this.cacheManager as any;

        this.logger.log(`CacheCollector: Inspecting CacheManager keys: ${Object.keys(cm)}`);

        // Wrap 'get'
        const originalGet = cm.get;
        if (originalGet) {
            this.logger.log('CacheCollector: Wrapping "get" method');
            cm.get = async function (...args: any[]) {
                const startTime = Date.now();
                const key = args[0];
                try {
                    const result = await originalGet.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('get', key, result !== undefined && result !== null ? 'hit' : 'miss', startTime, endTime);
                    return result;
                } catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('get', key, 'fail', startTime, endTime);
                    throw error;
                }
            };
        } else {
            this.logger.warn('CacheCollector: "get" method not found on CacheManager');
        }

        // Wrap 'store.get' if available (sometimes used directly by cache-manager v5)
        if (cm.store && cm.store.get) {
            // We could wrap store directly, but usually wrapping the facade is enough.
            this.logger.log('CacheCollector: Underlying store found: ' + (cm.store.name || cm.store.constructor?.name));
        }

        // Wrap 'set'
        const originalSet = cm.set;
        if (originalSet) {
            this.logger.log('CacheCollector: Wrapping "set" method');
            cm.set = async function (...args: any[]) {
                const startTime = Date.now();
                const key = args[0];
                const ttl = args[2];
                try {
                    const result = await originalSet.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('set', key, 'success', startTime, endTime, ttl);
                    return result;
                } catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('set', key, 'fail', startTime, endTime);
                    throw error;
                }
            };
        } else {
            this.logger.warn('CacheCollector: "set" method not found on CacheManager');
        }

        // Wrap 'del'
        const originalDel = cm.del;
        if (originalDel) {
            cm.del = async function (...args: any[]) {
                const startTime = Date.now();
                const key = args[0];
                try {
                    const result = await originalDel.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('del', key, 'success', startTime, endTime);
                    return result;
                } catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('del', key, 'fail', startTime, endTime);
                    throw error;
                }
            };
        }

        // Wrap 'reset'
        const originalReset = cm.reset;
        if (originalReset) {
            cm.reset = async function (...args: any[]) {
                const startTime = Date.now();
                try {
                    const result = await originalReset.apply(this, args);
                    const endTime = Date.now();
                    self.captureOperation('reset', '*', 'success', startTime, endTime);
                    return result;
                } catch (error) {
                    const endTime = Date.now();
                    self.captureOperation('reset', '*', 'fail', startTime, endTime);
                    throw error;
                }
            };
        }
    }

    private captureOperation(operation: any, key: string, result: any, startTime: number, endTime: number, ttl?: number) {
        try {
            // Determine store name/type (best effort)
            let storeName = 'unknown';
            const cm = this.cacheManager as any;

            if (cm.store) {
                if (cm.store.name) storeName = cm.store.name;
                else if (cm.store.constructor && cm.store.constructor.name) storeName = cm.store.constructor.name;
            }

            const profile: CacheProfile = {
                key: String(key),
                store: storeName,
                operation,
                result,
                ttl,
                duration: endTime - startTime,
                startTime,
            };

            // Debug log to check if we are capturing
            this.logger.debug(`CacheCollector: Captured ${operation} on ${key}. Duration: ${profile.duration}ms`);

            this.profiler.addCache(profile);
        } catch (e) {
            this.logger.error('Error capturing cache operation', e);
        }
    }
}

import { OnModuleInit } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import type { Cache } from 'cache-manager';
export declare class CacheCollector implements OnModuleInit {
    private readonly profiler;
    private readonly options;
    private readonly cacheManager;
    private readonly logger;
    constructor(profiler: ProfilerService, options: ProfilerOptions, cacheManager: Cache);
    onModuleInit(): void;
    private wrapCacheManager;
    private captureOperation;
}

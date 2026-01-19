import { OnModuleInit } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';
export declare class MongoCollector implements OnModuleInit {
    private profiler;
    private options;
    private logger;
    private mongodb;
    constructor(profiler: ProfilerService, options: ProfilerOptions);
    onModuleInit(): void;
    private patchMongo;
    private captureQuery;
}

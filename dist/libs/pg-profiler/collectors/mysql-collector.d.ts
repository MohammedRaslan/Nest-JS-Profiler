import { OnModuleInit } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';
export declare class MysqlCollector implements OnModuleInit {
    private profiler;
    private options;
    private logger;
    private mysql;
    constructor(profiler: ProfilerService, options: ProfilerOptions);
    onModuleInit(): void;
    private patchMysql;
}

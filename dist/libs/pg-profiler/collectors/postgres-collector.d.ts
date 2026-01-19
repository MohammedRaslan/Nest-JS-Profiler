import { OnModuleInit } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import { ExplainAnalyzer } from '../analyzers/explain-analyzer';
import type { ProfilerOptions } from '../common/profiler-options.interface';
export declare class PostgresCollector implements OnModuleInit {
    private profiler;
    private explainAnalyzer;
    private options;
    private logger;
    private originalQuery;
    constructor(profiler: ProfilerService, explainAnalyzer: ExplainAnalyzer, options: ProfilerOptions);
    onModuleInit(): void;
    private patchPg;
}

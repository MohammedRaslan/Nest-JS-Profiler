import { DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ProfilerOptions } from './common/profiler-options.interface';
export declare class ProfilerModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void;
    static forRoot(options?: ProfilerOptions): DynamicModule;
    static initialize(app: any): void;
}

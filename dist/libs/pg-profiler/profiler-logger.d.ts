import { ConsoleLogger } from '@nestjs/common';
import { ProfilerService } from './services/profiler.service';
export declare class ProfilerLogger extends ConsoleLogger {
    private profiler;
    constructor(profiler: ProfilerService);
    log(message: any, ...optionalParams: any[]): void;
    error(message: any, ...optionalParams: any[]): void;
    warn(message: any, ...optionalParams: any[]): void;
    debug(message: any, ...optionalParams: any[]): void;
    verbose(message: any, ...optionalParams: any[]): void;
    private captureLog;
}

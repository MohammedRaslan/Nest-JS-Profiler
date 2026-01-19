import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProfilerService } from '../services/profiler.service';
export declare class RequestProfilerInterceptor implements NestInterceptor {
    private profiler;
    private logger;
    constructor(profiler: ProfilerService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    private finishProfile;
    private sanitizeHeaders;
}

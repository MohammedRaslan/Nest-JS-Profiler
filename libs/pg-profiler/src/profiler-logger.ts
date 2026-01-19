import { Injectable, Scope, ConsoleLogger } from '@nestjs/common';
import { ProfilerService } from './services/profiler.service';

@Injectable({ scope: Scope.TRANSIENT })
export class ProfilerLogger extends ConsoleLogger {
    constructor(private profiler: ProfilerService) {
        super();
    }

    log(message: any, ...optionalParams: any[]) {
        super.log(message, ...optionalParams);
        this.captureLog('log', message, optionalParams);
    }

    error(message: any, ...optionalParams: any[]) {
        super.error(message, ...optionalParams);
        this.captureLog('error', message, optionalParams);
    }

    warn(message: any, ...optionalParams: any[]) {
        super.warn(message, ...optionalParams);
        this.captureLog('warn', message, optionalParams);
    }

    debug(message: any, ...optionalParams: any[]) {
        super.debug(message, ...optionalParams);
        this.captureLog('debug', message, optionalParams);
    }

    verbose(message: any, ...optionalParams: any[]) {
        super.verbose(message, ...optionalParams);
        this.captureLog('verbose', message, optionalParams);
    }

    private captureLog(level: string, message: any, params: any[]) {
        try {
            const context = params.length > 0 ? params[params.length - 1] : undefined;
            // Ensure message is a string
            const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message);

            this.profiler.addLog({
                level,
                message: msgStr,
                context: typeof context === 'string' ? context : undefined,
                timestamp: Date.now()
            });
        } catch (e) {
            // Prevent logger from breaking app
        }
    }
}

import { Injectable, OnModuleInit, Inject, Logger, ConsoleLogger } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';

@Injectable()
export class LogCollector implements OnModuleInit {
    private logger = new Logger(LogCollector.name);

    constructor(
        private profiler: ProfilerService,
        @Inject('PROFILER_OPTIONS') private options: ProfilerOptions
    ) { }

    onModuleInit() {
        if (this.options.collectLogs === false) {
            return;
        }

        this.patchProcessStream('stdout');
        this.patchProcessStream('stderr');
        this.logger.log('LogCollector initialized: Patching process.stdout/stderr');
    }

    private patchProcessStream(streamName: 'stdout' | 'stderr') {
        const stream = process[streamName];
        const originalWrite = stream.write;
        const self = this;

        stream.write = function (
            chunk: Uint8Array | string,
            encodingOrCb?: BufferEncoding | ((err?: Error) => void),
            cb?: (err?: Error) => void
        ): boolean {
            const result = originalWrite.apply(this, arguments as any);

            try {
                const msg = chunk.toString();
                if (msg.includes('[LogCollector]')) return result;

                self.capture(streamName === 'stderr' ? 'error' : 'log', msg);
            } catch (e) {
            }

            return result;
        };
    }

    private capture(level: string, message: string) {
        if (!message.trim()) return;

        this.profiler.addLog({
            level,
            message: message.trim(),
            timestamp: Date.now()
        });
    }
}

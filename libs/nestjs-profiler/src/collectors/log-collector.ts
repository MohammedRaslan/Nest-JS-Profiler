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

    // Strip ANSI/VT100 escape codes
    private stripAnsi(str: string): string {
        return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
    }

    // Detect level from NestJS ANSI color codes present in the raw chunk
    // NestJS uses: green=LOG, yellow=WARN, red=ERROR, brightMagenta=DEBUG, brightCyan=VERBOSE
    private detectLevel(raw: string, fallback: string): string {
        if (raw.includes('\x1b[31m'))  return 'error';   // red
        if (raw.includes('\x1b[33m'))  return 'warn';    // yellow
        if (raw.includes('\x1b[95m'))  return 'debug';   // bright magenta
        if (raw.includes('\x1b[96m'))  return 'verbose'; // bright cyan
        if (raw.includes('\x1b[32m'))  return 'log';     // green
        return fallback;
    }

    // Parse NestJS log format:  [Nest] PID - DATE    LEVEL [Context] message
    private parseNestLog(clean: string): { context?: string; message: string } {
        const match = clean.match(/^\[Nest\]\s+\d+\s+-\s+[\d/,: APM]+\s+\w+\s+\[([^\]]+)\]\s+(.+)$/s);
        if (match) return { context: match[1], message: match[2].trim() };
        // Strip the "[Nest] PID - DATE LEVEL" prefix if present but context/message didn't match
        const prefixStripped = clean.replace(/^\[Nest\]\s+\d+\s+-\s+[\d/,: APM]+\s+\w+\s+/, '').trim();
        return { message: prefixStripped || clean };
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
                const raw = chunk.toString();
                if (raw.includes('[LogCollector]')) return result;

                const level = self.detectLevel(raw, streamName === 'stderr' ? 'error' : 'log');
                const clean = self.stripAnsi(raw).trim();
                if (!clean) return result;

                const { context, message } = self.parseNestLog(clean);
                if (!message) return result;

                self.profiler.addLog({ level, message, context, timestamp: Date.now() });
            } catch (e) {
            }

            return result;
        };
    }
}

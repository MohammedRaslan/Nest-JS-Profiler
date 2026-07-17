import { Injectable } from '@nestjs/common';

// ─── Data shapes ─────────────────────────────────────────────────────────────

export interface CronJobDefinition {
    type: 'cron';
    name: string;
    expression: string;
    expressionHuman: string;
    nextRun: number | null;   // epoch ms
    lastRun: number | null;   // epoch ms
    running: boolean;
    handler: string;          // "ClassName.methodName"
    className: string;
    methodName: string;
    file: string;
}

export interface IntervalDefinition {
    type: 'interval';
    name: string;
    ms: number;
    handler: string;
    className: string;
    methodName: string;
    file: string;
}

export interface TimeoutDefinition {
    type: 'timeout';
    name: string;
    ms: number;
    handler: string;
    className: string;
    methodName: string;
    file: string;
}

export interface CronReport {
    cronJobs: CronJobDefinition[];
    intervals: IntervalDefinition[];
    timeouts: TimeoutDefinition[];
    scannedAt: number;
    hasScheduler: boolean;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface HandlerMeta {
    className: string;
    methodName: string;
    file: string;
    intervalMs?: number;
    timeoutMs?: number;
}

const EMPTY_HANDLER: HandlerMeta = { className: '', methodName: '', file: '' };

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CronExplorerService {
    /**
     * Live reference to SchedulerRegistry (from @nestjs/schedule).
     * Null if the module is not installed / imported.
     */
    private static _registry: any = null;
    private static _hasScheduler = false;

    /**
     * Handler metadata discovered from reflect-metadata scan.
     * Key = job/interval/timeout name as registered in SchedulerRegistry.
     */
    private static _handlers = new Map<string, HandlerMeta>();

    // ── Public API ────────────────────────────────────────────────────────────

    initialize(schedulerRegistry: any, modulesContainer: any): void {
        CronExplorerService._registry = schedulerRegistry ?? null;
        CronExplorerService._hasScheduler = !!schedulerRegistry;
        if (modulesContainer) {
            this.scanHandlers(modulesContainer);
        }
    }

    /**
     * Returns a fresh report each call — running / nextRun come from the
     * live registry so they reflect real-time state.
     */
    getReport(): CronReport {
        if (!CronExplorerService._registry) {
            return {
                cronJobs: [],
                intervals: [],
                timeouts: [],
                scannedAt: Date.now(),
                hasScheduler: false,
            };
        }
        return this.buildFromRegistry();
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private buildFromRegistry(): CronReport {
        const registry = CronExplorerService._registry;
        const handlers = CronExplorerService._handlers;

        const cronJobs: CronJobDefinition[] = [];
        const intervals: IntervalDefinition[] = [];
        const timeouts: TimeoutDefinition[] = [];

        // ── Cron jobs ─────────────────────────────────────────────────────────
        try {
            const jobs: Map<string, any> = registry.getCronJobs();
            for (const [name, job] of jobs.entries()) {
                const h = handlers.get(name) ?? EMPTY_HANDLER;

                // nextDate() returns a Luxon DateTime in cron v2/v3
                let nextRun: number | null = null;
                try {
                    const nd = job.nextDate?.();
                    if (nd) {
                        nextRun = typeof nd.toMillis === 'function'
                            ? nd.toMillis()
                            : nd.toDate?.().getTime() ?? nd.getTime?.() ?? null;
                    }
                } catch { /* ignore */ }

                let lastRun: number | null = null;
                try {
                    const ld = job.lastDate?.();
                    lastRun = ld?.getTime?.() ?? null;
                } catch { /* ignore */ }

                let expression = '';
                try {
                    expression = job.cronTime?.source ?? job.cronTime?.toString?.() ?? '';
                } catch { /* ignore */ }

                cronJobs.push({
                    type: 'cron',
                    name,
                    expression,
                    expressionHuman: humanizeCron(expression),
                    nextRun,
                    lastRun,
                    running: !!job.running,
                    handler: h.className && h.methodName
                        ? `${h.className}.${h.methodName}`
                        : name,
                    className: h.className ?? '',
                    methodName: h.methodName ?? '',
                    file: h.file ?? '',
                });
            }
        } catch { /* @nestjs/schedule not available */ }

        // Sort: running first, then by next execution time
        cronJobs.sort((a, b) => {
            if (a.running !== b.running) return a.running ? -1 : 1;
            return (a.nextRun ?? Infinity) - (b.nextRun ?? Infinity);
        });

        // ── Intervals ─────────────────────────────────────────────────────────
        try {
            const names: string[] = registry.getIntervals();
            for (const name of names) {
                const h = handlers.get(name) ?? EMPTY_HANDLER;
                intervals.push({
                    type: 'interval',
                    name,
                    ms: h.intervalMs ?? 0,
                    handler: h.className && h.methodName
                        ? `${h.className}.${h.methodName}`
                        : name,
                    className: h.className ?? '',
                    methodName: h.methodName ?? '',
                    file: h.file ?? '',
                });
            }
        } catch { /* ignore */ }

        // ── Timeouts ──────────────────────────────────────────────────────────
        try {
            const names: string[] = registry.getTimeouts();
            for (const name of names) {
                const h = handlers.get(name) ?? EMPTY_HANDLER;
                timeouts.push({
                    type: 'timeout',
                    name,
                    ms: h.timeoutMs ?? 0,
                    handler: h.className && h.methodName
                        ? `${h.className}.${h.methodName}`
                        : name,
                    className: h.className ?? '',
                    methodName: h.methodName ?? '',
                    file: h.file ?? '',
                });
            }
        } catch { /* ignore */ }

        return {
            cronJobs,
            intervals,
            timeouts,
            scannedAt: Date.now(),
            hasScheduler: true,
        };
    }

    /**
     * Walk every provider in the module container and read
     * @Cron / @Interval / @Timeout reflect-metadata to map job name → handler.
     */
    private scanHandlers(modulesContainer: Map<any, any>): void {
        const CRON_KEY     = 'SCHEDULE_CRON_OPTIONS';
        const INTERVAL_KEY = 'SCHEDULE_INTERVAL_OPTIONS';
        const TIMEOUT_KEY  = 'SCHEDULE_TIMEOUT_OPTIONS';
        // @nestjs/schedule stores the registered name separately under this key
        const NAME_KEY     = 'SCHEDULER_NAME';

        for (const mod of modulesContainer.values()) {
            const providers = [...((mod as any).providers?.values() ?? [])];
            for (const wrapper of providers) {
                if (!wrapper?.instance || wrapper.isAlias) continue;
                const instance = wrapper.instance;
                const proto = Object.getPrototypeOf(instance);
                if (!proto || proto === Object.prototype) continue;

                const file = findFileForClass(instance.constructor);

                Object.getOwnPropertyNames(proto).forEach(methodName => {
                    if (methodName === 'constructor') return;
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(proto, methodName);
                        if (!descriptor || typeof descriptor.value !== 'function') return;
                        const fn = descriptor.value;
                        const className = instance.constructor.name;
                        // SCHEDULER_NAME is the canonical name used by SchedulerRegistry
                        const schedulerName: string | undefined = Reflect.getMetadata(NAME_KEY, fn);

                        const cronOpts = Reflect.getMetadata(CRON_KEY, fn);
                        if (cronOpts) {
                            const key = cronOpts.name || schedulerName || methodName;
                            CronExplorerService._handlers.set(key, { className, methodName, file });
                        }

                        const intervalOpts = Reflect.getMetadata(INTERVAL_KEY, fn);
                        if (intervalOpts) {
                            // For @Interval the name lives in SCHEDULER_NAME, not in intervalOpts
                            const key = schedulerName || intervalOpts.name || methodName;
                            CronExplorerService._handlers.set(key, {
                                className, methodName, file,
                                intervalMs: intervalOpts.timeout,
                            });
                        }

                        const timeoutOpts = Reflect.getMetadata(TIMEOUT_KEY, fn);
                        if (timeoutOpts) {
                            // Same for @Timeout
                            const key = schedulerName || timeoutOpts.name || methodName;
                            CronExplorerService._handlers.set(key, {
                                className, methodName, file,
                                timeoutMs: timeoutOpts.timeout,
                            });
                        }
                    } catch { /* ignore */ }
                });
            }
        }
    }
}

// ─── Helpers (module-level, not exported) ────────────────────────────────────

function findFileForClass(ctor: Function): string {
    if (!ctor?.name) return '';
    try {
        const cache = (require as any).cache as Record<string, any>;
        for (const [filename, mod] of Object.entries(cache)) {
            if (!mod?.exports) continue;
            const exp = mod.exports;
            if (exp[ctor.name] === ctor || exp?.default === ctor) {
                return filename.replace(/\.js$/, '.ts');
            }
        }
    } catch { /* ignore */ }
    return '';
}

/**
 * Convert a cron expression (5-part or 6-part with seconds) to a short
 * human-readable label. Falls back to the raw expression on unknown patterns.
 */
export function humanizeCron(expression: string): string {
    if (!expression) return '';
    const parts = expression.trim().split(/\s+/);

    let min = '', hour = '', dom = '', month = '', dow = '';
    if (parts.length === 6) {
        [, min, hour, dom, month, dow] = parts;
    } else if (parts.length === 5) {
        [min, hour, dom, month, dow] = parts;
    } else {
        return expression;
    }

    const all = (p: string) => p === '*';
    const zero = (p: string) => p === '0';
    const everyN = (p: string) => p.match(/^\*\/(\d+)$/)?.[1];
    const fixed = (p: string) => /^\d+$/.test(p) ? parseInt(p) : null;

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmtTime = (h: number, m: number) =>
        `${h}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`.replace('12:00 PM', 'noon').replace('00:00 AM', 'midnight');

    // Every minute
    if (all(min) && all(hour) && all(dom) && all(month) && all(dow))
        return 'Every minute';

    // Every N minutes
    const nMin = everyN(min);
    if (nMin && all(hour) && all(dom) && all(month) && all(dow))
        return parseInt(nMin) === 1 ? 'Every minute' : `Every ${nMin} minutes`;

    // Every N hours (at :00)
    const nHour = everyN(hour);
    if (zero(min) && nHour && all(dom) && all(month) && all(dow))
        return parseInt(nHour) === 1 ? 'Every hour' : `Every ${nHour} hours`;

    // Every hour (at :00)
    if (zero(min) && all(hour) && all(dom) && all(month) && all(dow))
        return 'Every hour';

    // Every N days at midnight
    const nDom = everyN(dom);
    if (zero(min) && zero(hour) && nDom && all(month) && all(dow))
        return `Every ${nDom} days`;

    // Daily at specific time
    const h = fixed(hour), m = fixed(min);
    if (h !== null && m !== null && all(dom) && all(month) && all(dow))
        return `Daily at ${fmtTime(h, m)}`;

    // Weekdays at specific time
    if (h !== null && m !== null && all(dom) && all(month) &&
        (dow === '1-5' || dow === 'MON-FRI'))
        return `Weekdays at ${fmtTime(h, m)}`;

    // Specific weekday at specific time
    const dowN = fixed(dow);
    if (h !== null && m !== null && all(dom) && all(month) &&
        dowN !== null && dowN >= 0 && dowN <= 6)
        return `Every ${DAYS[dowN]} at ${fmtTime(h, m)}`;

    // Monthly on a specific day
    const dayN = fixed(dom);
    if (zero(min) && zero(hour) && dayN !== null && all(month) && all(dow)) {
        const suffix = dayN === 1 ? 'st' : dayN === 2 ? 'nd' : dayN === 3 ? 'rd' : 'th';
        return `Monthly on the ${dayN}${suffix}`;
    }

    return expression;
}

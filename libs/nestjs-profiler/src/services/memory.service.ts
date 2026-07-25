import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as v8 from 'v8';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemorySample {
  timestamp: number;
  heapUsed: number;        // bytes
  heapTotal: number;       // bytes
  rss: number;             // bytes
  external: number;        // bytes
  arrayBuffers: number;    // bytes
  heapSizeLimit: number;   // bytes (from v8)
  detachedContexts: number; // direct leak signal from v8
}

export type MemoryTrend = 'stable' | 'growing' | 'likely_leak';

export interface MemoryReport {
  current: MemorySample;
  trend: MemoryTrend;
  leakScore: number;           // 0-100
  leakScoreBreakdown: {
    growthRate: number;
    detachedContexts: number;
    sustained: number;
  };
  windowSize: number;          // number of samples in the rolling window
  samples: MemorySample[];     // last N samples for charting
  topMemoryRequests: RequestMemoryDelta[];
  gcAvailable: boolean;
  alerts: string[];
}

export interface RequestMemoryDelta {
  method: string;
  url: string;
  heapDeltaBytes: number;
  timestamp: number;
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS   = 10_000;   // sample every 10 s
const WINDOW_SIZE        = 60;       // 60 samples = 10 min of history
const MAX_REQUEST_DELTAS = 50;       // keep top-N request deltas
const GROWTH_THRESHOLD   = 0.05;    // 5% growth over window = "growing"
const LEAK_THRESHOLD     = 0.15;    // 15% growth over window = likely_leak
const MB                 = 1024 * 1024;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MemoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryService.name);

  private samples: MemorySample[]           = [];
  private requestDeltas: RequestMemoryDelta[] = [];
  private pollTimer: NodeJS.Timeout | null  = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.takeSample();  // immediate baseline
    this.pollTimer = setInterval(() => this.takeSample(), POLL_INTERVAL_MS);
    this.logger.log('MemoryService started — polling every 10 s');
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ── Sampling ───────────────────────────────────────────────────────────────

  private takeSample(): void {
    const mem  = process.memoryUsage();
    const heap = v8.getHeapStatistics();

    const sample: MemorySample = {
      timestamp:        Date.now(),
      heapUsed:         mem.heapUsed,
      heapTotal:        mem.heapTotal,
      rss:              mem.rss,
      external:         mem.external,
      arrayBuffers:     mem.arrayBuffers,
      heapSizeLimit:    heap.heap_size_limit,
      detachedContexts: heap.number_of_detached_contexts,
    };

    this.samples.push(sample);

    if (this.samples.length > WINDOW_SIZE) {
      this.samples.shift();
    }

    if (sample.detachedContexts > 5) {
      this.logger.warn(
        `[memory] ${sample.detachedContexts} detached V8 contexts detected — possible leak`,
      );
    }
  }

  // ── Per-request tracking ───────────────────────────────────────────────────

  /** Call at the start of a request to get a baseline heap snapshot */
  snapshotBefore(): number {
    return process.memoryUsage().heapUsed;
  }

  /** Call at the end of a request with the baseline from snapshotBefore() */
  recordDelta(
    method: string,
    url: string,
    heapBefore: number,
    durationMs: number,
  ): void {
    const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
    if (Math.abs(heapDeltaBytes) < 1024) return; // ignore < 1 KB noise

    this.requestDeltas.push({
      method,
      url,
      heapDeltaBytes,
      timestamp: Date.now(),
      durationMs,
    });

    // Keep only the most recent MAX_REQUEST_DELTAS
    if (this.requestDeltas.length > MAX_REQUEST_DELTAS) {
      this.requestDeltas.shift();
    }
  }

  // ── Trend + leak scoring ───────────────────────────────────────────────────

  private computeTrend(): { trend: MemoryTrend; leakScore: number; breakdown: { growthRate: number; detachedContexts: number; sustained: number } } {
    if (this.samples.length < 10) {
      return { trend: 'stable', leakScore: 0, breakdown: { growthRate: 0, detachedContexts: 0, sustained: 0 } };
    }

    const half    = Math.floor(this.samples.length / 2);
    const first   = this.samples.slice(0, half);
    const second  = this.samples.slice(half);

    const avgFirst  = first.reduce((s, x) => s + x.heapUsed, 0) / first.length;
    const avgSecond = second.reduce((s, x) => s + x.heapUsed, 0) / second.length;

    const growthRate = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;

    // Detached contexts score (0–40 pts)
    const latest      = this.samples[this.samples.length - 1];
    const detachedPts = Math.min(40, latest.detachedContexts * 8);

    // Growth rate score (0–40 pts)
    const growthPts = Math.min(40, Math.max(0, growthRate / LEAK_THRESHOLD) * 40);

    // Sustained growth check — did heap grow in > 70% of intervals? (0–20 pts)
    let growingIntervals = 0;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].heapUsed > this.samples[i - 1].heapUsed) growingIntervals++;
    }
    const sustainedRatio = growingIntervals / (this.samples.length - 1);
    const sustainedPts   = sustainedRatio > 0.7 ? Math.round(sustainedRatio * 20) : 0;

    const leakScore = Math.round(Math.min(100, detachedPts + growthPts + sustainedPts));

    let trend: MemoryTrend;
    if (growthRate >= LEAK_THRESHOLD || leakScore >= 60) {
      trend = 'likely_leak';
    } else if (growthRate >= GROWTH_THRESHOLD || leakScore >= 30) {
      trend = 'growing';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      leakScore,
      breakdown: {
        growthRate:       Math.round(growthPts),
        detachedContexts: Math.round(detachedPts),
        sustained:        Math.round(sustainedPts),
      },
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getReport(): MemoryReport {
    const { trend, leakScore, breakdown } = this.computeTrend();

    const latest = this.samples[this.samples.length - 1] ?? this.buildCurrentSample();

    const topRequests = [...this.requestDeltas]
      .sort((a, b) => b.heapDeltaBytes - a.heapDeltaBytes)
      .slice(0, 20);

    const alerts: string[] = [];
    if (leakScore >= 60) alerts.push('High leak score — memory is growing rapidly');
    if (latest.detachedContexts > 5) alerts.push(`${latest.detachedContexts} detached V8 contexts detected`);
    if (latest.heapUsed / latest.heapSizeLimit > 0.85) alerts.push('Heap usage above 85% of limit');

    return {
      current: latest,
      trend,
      leakScore,
      leakScoreBreakdown: breakdown,
      windowSize: this.samples.length,
      samples: [...this.samples],
      topMemoryRequests: topRequests,
      gcAvailable: typeof (global as any).gc === 'function',
      alerts,
    };
  }

  /** Force GC if Node was started with --expose-gc */
  forceGc(): { success: boolean; message: string; heapFreedBytes?: number } {
    const gc = (global as any).gc;
    if (typeof gc !== 'function') {
      return {
        success: false,
        message: 'GC not available. Start Node with --expose-gc to enable manual GC.',
      };
    }
    const before = process.memoryUsage().heapUsed;
    gc();
    this.takeSample(); // record post-GC state immediately
    const after  = process.memoryUsage().heapUsed;
    const freed  = before - after;
    this.logger.log(`[memory] Manual GC freed ${(freed / MB).toFixed(2)} MB`);
    return { success: true, message: `GC complete — freed ~${(freed / MB).toFixed(2)} MB`, heapFreedBytes: freed };
  }

  /** Write a V8 heap snapshot to disk and return the file path */
  takeSnapshot(): { success: boolean; filePath?: string; message: string } {
    try {
      // Always pass a full file path — passing a directory causes EISDIR on some Node versions
      const fileName = `Heap-${Date.now()}.heapsnapshot`;
      const filePath = path.join(process.cwd(), fileName);
      v8.writeHeapSnapshot(filePath);
      this.logger.log(`[memory] Heap snapshot written to ${filePath}`);
      return { success: true, filePath, message: `Snapshot saved: ${fileName} (open in Chrome DevTools → Memory tab)` };
    } catch (err: any) {
      return { success: false, message: `Snapshot failed: ${err?.message ?? err}` };
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildCurrentSample(): MemorySample {
    const mem  = process.memoryUsage();
    const heap = v8.getHeapStatistics();
    return {
      timestamp:        Date.now(),
      heapUsed:         mem.heapUsed,
      heapTotal:        mem.heapTotal,
      rss:              mem.rss,
      external:         mem.external,
      arrayBuffers:     mem.arrayBuffers,
      heapSizeLimit:    heap.heap_size_limit,
      detachedContexts: heap.number_of_detached_contexts,
    };
  }
}

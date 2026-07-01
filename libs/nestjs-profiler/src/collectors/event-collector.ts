import { Injectable, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import * as crypto from 'crypto';
import { ProfilerService } from '../services/profiler.service';
import { EventProfile, EventListenerTrace } from '../common/profiler.model';

// Resolve the EventEmitter2 CLASS from the RUNNING APP's node_modules, not the
// profiler package's own workspace. When installed via file: symlink, plain
// require('@nestjs/event-emitter') follows the symlink's real path and resolves
// from the workspace — a different class reference than the one registered in
// the app's DI container. Using require.resolve with paths:[process.cwd()]
// forces resolution from the app root, giving the correct class token.
function resolveEE2Token(): any {
  try {
    const resolved = require.resolve('@nestjs/event-emitter', {
      paths: [process.cwd()],
    });
    return require(resolved).EventEmitter2;
  } catch {
    try {
      // Fallback for standard (non-symlink) installs
      return require('@nestjs/event-emitter').EventEmitter2;
    } catch {
      return Symbol('PROFILER_NO_EVENT_EMITTER');
    }
  }
}
const EE2_TOKEN = resolveEE2Token();

interface EventALSContext {
  eventId: string;
  depth: number;
}

// Module-level ALS so it survives across async boundaries
const eventALS = new AsyncLocalStorage<EventALSContext>();

@Injectable()
export class EventCollector implements OnModuleInit {
  /**
   * Populated by ProfilerModule.initialize() after the app bootstraps.
   * Maps event-name → ordered list of {name, file} objects,
   * in the same order that EventSubscribersLoader registers them.
   * Used for lazy listener-name and file resolution (see makeWrappedListener).
   */
  private resolvedListenerNames = new Map<string, Array<{ name: string; file: string }>>();

  /** Counts how many listeners have been registered per event name. */
  private readonly listenerRegistrationCounters = new Map<string, number>();

  constructor(
    private readonly profilerService: ProfilerService,
    // EventEmitter2 is registered with the string token 'EventEmitter2' by @nestjs/event-emitter.
    // @Optional ensures the profiler doesn't break if the package isn't installed.
    @Optional() @Inject(EE2_TOKEN) private readonly eventEmitter?: any,
  ) {}

  /** Called from ProfilerModule.initialize() to supply resolved names and file paths. */
  setListenerNames(map: Map<string, Array<{ name: string; file: string }>>): void {
    this.resolvedListenerNames = map;
  }

  onModuleInit() {
    if (this.eventEmitter) {
      this.patchEmitter(this.eventEmitter);
    }
  }

  private patchEmitter(emitter: any) {
    if (emitter.__profilerPatched) return;
    emitter.__profilerPatched = true;

    const self = this;

    // ── Wrap each registered listener so we can time it ───────────────────
    //
    // listenerIndex: the 0-based registration order for this specific event.
    // At call time we first look up the pre-built resolvedListenerNames map
    // (populated by ProfilerModule.initialize).  If that map isn't populated
    // yet we fall back to the function's own .name property (works for
    // @nestjs/event-emitter v1 which uses .bind()), and finally to a
    // numbered placeholder like "handler-1".
    const makeWrappedListener = (
      fn: Function,
      eventName: string,
      listenerIndex: number,
    ): Function => {
      // Eager fallback — works for v1-style .bind() listeners
      const eagerName = ((fn as any).name || '')
        .replace(/^bound /, '')
        .replace(/^async /, '')
        .trim();

      return async function profilerListener(...args: any[]) {
        // Lazy resolution so initialize() called after registration still works
        const resolvedInfo = self.resolvedListenerNames.get(eventName)?.[listenerIndex];
        const listenerName = resolvedInfo?.name || eagerName || `handler-${listenerIndex + 1}`;
        const listenerFile = resolvedInfo?.file || '';

        const trace: EventListenerTrace = {
          name: listenerName,
          file: listenerFile,
          startTime: Date.now(),
          duration: 0,
          status: 'success',
        };
        try {
          const result = await (fn as any)(...args);
          trace.duration = Date.now() - trace.startTime;
          self.profilerService.addListenerTrace(
            eventALS.getStore()?.eventId,
            trace,
          );
          return result;
        } catch (e: any) {
          trace.duration = Date.now() - trace.startTime;
          trace.status = 'error';
          trace.error = e?.message ?? String(e);
          self.profilerService.addListenerTrace(
            eventALS.getStore()?.eventId,
            trace,
          );
          throw e;
        }
      };
    };

    // Patch on / addListener / once / prependListener
    const origOn = emitter.on.bind(emitter);
    const origOnce = emitter.once.bind(emitter);
    const origPrepend = emitter.prependListener
      ? emitter.prependListener.bind(emitter)
      : null;

    emitter.on = function (event: any, fn: Function, options?: any) {
      const idx = self.listenerRegistrationCounters.get(String(event)) ?? 0;
      self.listenerRegistrationCounters.set(String(event), idx + 1);
      return origOn(
        event,
        makeWrappedListener(fn, String(event), idx),
        options,
      );
    };
    emitter.addListener = emitter.on;

    emitter.once = function (event: any, fn: Function, options?: any) {
      const idx = self.listenerRegistrationCounters.get(String(event)) ?? 0;
      self.listenerRegistrationCounters.set(String(event), idx + 1);
      return origOnce(
        event,
        makeWrappedListener(fn, String(event), idx),
        options,
      );
    };

    if (origPrepend) {
      emitter.prependListener = function (
        event: any,
        fn: Function,
        options?: any,
      ) {
        const idx = self.listenerRegistrationCounters.get(String(event)) ?? 0;
        self.listenerRegistrationCounters.set(String(event), idx + 1);
        return origPrepend(
          event,
          makeWrappedListener(fn, String(event), idx),
          options,
        );
      };
    }

    // ── Patch emit (sync) ─────────────────────────────────────────────────
    const origEmit = emitter.emit.bind(emitter);
    emitter.emit = function (event: string, ...args: any[]) {
      if (typeof event !== 'string') return origEmit(event, ...args);
      const profile = self.buildProfile(event, args, false);
      return eventALS.run({ eventId: profile.id, depth: profile.depth }, () => {
        try {
          const result = origEmit(event, ...args);
          self.profilerService.finalizeEvent(profile.id, 'success');
          return result;
        } catch (e: any) {
          self.profilerService.finalizeEvent(profile.id, 'error', e?.message);
          throw e;
        }
      });
    };

    // ── Patch emitAsync (async) ───────────────────────────────────────────
    const origEmitAsync = emitter.emitAsync?.bind(emitter);
    if (origEmitAsync) {
      emitter.emitAsync = async function (event: string, ...args: any[]) {
        if (typeof event !== 'string') return origEmitAsync(event, ...args);
        const profile = self.buildProfile(event, args, true);
        return eventALS.run(
          { eventId: profile.id, depth: profile.depth },
          async () => {
            try {
              const result = await origEmitAsync(event, ...args);
              self.profilerService.finalizeEvent(profile.id, 'success');
              return result;
            } catch (e: any) {
              self.profilerService.finalizeEvent(
                profile.id,
                'error',
                e?.message,
              );
              throw e;
            }
          },
        );
      };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildProfile(
    eventName: string,
    args: any[],
    isAsync: boolean,
  ): EventProfile {
    const parent = eventALS.getStore();
    const depth = parent ? parent.depth + 1 : 0;

    const profile: EventProfile = {
      id: crypto.randomUUID(),
      eventName,
      payloadPreview: this.serializePayload(args[0]),
      emittedAt: Date.now(),
      isAsync,
      ...this.getCallerLocation(),
      listeners: [],
      totalDuration: 0,
      status: 'pending',
      parentEventId: parent?.eventId,
      requestId: this.profilerService.getCurrentRequestId(),
      depth,
      childEventIds: [],
    };

    if (parent?.eventId) {
      this.profilerService.linkChildEvent(parent.eventId, profile.id);
    }

    this.profilerService.addEvent(profile);
    return profile;
  }

  private serializePayload(payload: any): string {
    try {
      const str = JSON.stringify(payload);
      if (!str) return '';
      return str.length > 200 ? str.slice(0, 200) + '…' : str;
    } catch {
      return '[unserializable]';
    }
  }

  /**
   * Walk the call stack and return the first frame that belongs to app code.
   * Returns both the function name (emitterLocation) and the file:line
   * (emitterFile) so the UI can offer a copy-to-clipboard shortcut.
   */
  private getCallerLocation(): { emitterLocation: string; emitterFile: string } {
    const lines = (new Error().stack ?? '').split('\n').slice(1);
    const skip = [
      'event-collector',
      'EventCollector',
      'profilerListener',
      'AsyncLocalStorage',
      'node:',
      'eventemitter2',
      'node_modules/@nestjs/event-emitter',
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      if (skip.some((s) => trimmed.includes(s))) continue;

      // "at ClassName.method (/abs/path:line:col)"
      const m = trimmed.match(/^at (.+?)\s+\((.+?):(\d+):\d+\)/);
      if (m) {
        const name = m[1];
        if (!name.startsWith('Object.') && name !== 'Function') {
          return { emitterLocation: name, emitterFile: `${m[2]}:${m[3]}` };
        }
      }
      // anonymous or arrow: "at /abs/path:line:col"
      const anon = trimmed.match(/^at (.+?):(\d+):\d+$/);
      if (anon && !anon[1].startsWith('node:')) {
        return { emitterLocation: anon[1], emitterFile: `${anon[1]}:${anon[2]}` };
      }
    }
    return { emitterLocation: 'unknown', emitterFile: '' };
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ProfilerOptions } from '../common/profiler-options.interface';

/** 24-hour session TTL in milliseconds */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const COOKIE_NAME = '__profiler_session';

/**
 * Module-level variable — set synchronously in ProfilerModule.forRoot() before
 * any DI or configure() logic runs. This guarantees the middleware always sees
 * the real options, regardless of NestJS's dynamic-module merge timing.
 */
let _authOptions: ProfilerOptions = {};

export function setProfilerAuthOptions(options: ProfilerOptions): void {
    _authOptions = options;
}

// ─── Cookie helpers ────────────────────────────────────────────────────────

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {};
    return Object.fromEntries(
        cookieHeader.split(';').map(pair => {
            const idx = pair.indexOf('=');
            if (idx === -1) return [pair.trim(), ''];
            return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim())];
        }),
    );
}

function signToken(username: string, expiry: number, password: string): string {
    return createHmac('sha256', password)
        .update(`${username}:${expiry}`)
        .digest('hex');
}

export function buildSessionCookie(username: string, password: string): string {
    const expiry = Date.now() + SESSION_TTL_MS;
    const hmac = signToken(username, expiry, password);
    const token = encodeURIComponent(`${username}:${expiry}:${hmac}`);
    return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/__profiler; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookie(): string {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/__profiler; Max-Age=0`;
}

export function verifySessionCookie(
    cookieHeader: string | undefined,
    username: string,
    password: string,
): boolean {
    try {
        const cookies = parseCookies(cookieHeader);
        const raw = cookies[COOKIE_NAME];
        if (!raw) return false;

        const parts = raw.split(':');
        if (parts.length < 3) return false;

        const cookieUser = parts[0];
        const expiry = parseInt(parts[1], 10);
        const cookieHmac = parts.slice(2).join(':');

        if (isNaN(expiry) || Date.now() > expiry) return false;
        if (cookieUser !== username) return false;

        const expected = signToken(username, expiry, password);
        const expectedBuf = Buffer.from(expected, 'hex');
        const actualBuf = Buffer.from(cookieHmac, 'hex');

        if (expectedBuf.length !== actualBuf.length) return false;
        return timingSafeEqual(expectedBuf, actualBuf);
    } catch {
        return false;
    }
}

// ─── Middleware factory ────────────────────────────────────────────────────

/**
 * Returns a plain Express middleware function that reads from the module-level
 * _authOptions variable. No parameters needed — options were set by forRoot().
 */
export function createProfilerAuthMiddleware() {
    return function profilerAuthMiddleware(req: any, res: any, next: () => void) {
        const auth = _authOptions?.auth;

        // Auth disabled (default) — pass through
        if (!auth || auth.enabled === false) {
            return next();
        }

        const url: string = req.url || '';

        // Always allow the login page and logout endpoint (prevents redirect loops)
        if (
            url === '/login' ||
            url.startsWith('/login?') ||
            url === '/login/' ||
            url === '/logout' ||
            url.startsWith('/logout?')
        ) {
            return next();
        }

        // Allow static assets without auth
        if (url.startsWith('/assets/') || url.startsWith('/js/')) {
            return next();
        }

        // Verify HMAC-signed session cookie
        const cookieHeader: string | undefined = req.headers?.cookie;
        const valid = verifySessionCookie(cookieHeader, auth.username, auth.password);

        if (valid) {
            return next();
        }

        // Redirect to login, preserving intended destination
        const returnTo = encodeURIComponent(req.originalUrl || '/__profiler');
        res.writeHead(302, { Location: `/__profiler/login?returnTo=${returnTo}` });
        res.end();
    };
}

/**
 * Stub class kept so the DI token resolves cleanly in the controller.
 * Actual auth work is done by the factory-based functional middleware above.
 */
@Injectable()
export class ProfilerAuthMiddleware implements NestMiddleware {
    use(_req: any, _res: any, next: () => void) {
        next();
    }
}

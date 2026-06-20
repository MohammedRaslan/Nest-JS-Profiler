import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface AuditResult {
    vulnerabilities: Record<string, AuditVulnerability>;
    metadata: {
        vulnerabilities: {
            info: number;
            low: number;
            moderate: number;
            high: number;
            critical: number;
            total: number;
        };
        dependencies: {
            total: number;
            prod: number;
            dev: number;
        };
    };
}

export interface AuditVulnerability {
    name: string;
    severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
    isDirect: boolean;
    via: any[];
    effects: string[];
    range: string;
    nodes: string[];
    fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
}

export interface OutdatedPackage {
    current: string;
    wanted: string;
    latest: string;
    dependent: string;
    location?: string;
}

export interface HealthReport {
    audit: AuditResult | null;
    outdated: Record<string, OutdatedPackage>;
    nodeVersion: string;
    npmVersion: string;
    engines: Record<string, string> | null;
    packageManager: 'npm' | 'yarn' | 'pnpm';
    scannedAt: number;
    error?: string;
}

/** Server-side cache TTL: 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);
    private cachedReport: HealthReport | null = null;

    async runHealthCheck(force = false): Promise<HealthReport> {
        // Return cached result if still fresh and not a forced refresh
        if (!force && this.cachedReport) {
            const age = Date.now() - this.cachedReport.scannedAt;
            if (age < CACHE_TTL_MS) {
                return { ...this.cachedReport, fromCache: true } as any;
            }
        }

        const cwd = process.cwd();
        const packageManager = this.detectPackageManager(cwd);
        const engines = this.getEngines(cwd);
        const npmVersion = await this.getNpmVersion();

        const [auditResult, outdatedResult] = await Promise.all([
            this.runAudit(cwd, packageManager),
            this.runOutdated(cwd, packageManager),
        ]);

        const report: HealthReport = {
            audit: auditResult.data,
            outdated: outdatedResult,
            nodeVersion: process.version,
            npmVersion,
            engines,
            packageManager,
            scannedAt: Date.now(),
            error: auditResult.error,
        };

        this.cachedReport = report;
        return report;
    }

    private async runAudit(
        cwd: string,
        pm: 'npm' | 'yarn' | 'pnpm',
    ): Promise<{ data: AuditResult | null; error?: string }> {
        // npm audit exits with code 1 when vulnerabilities are found — we still get valid JSON on stdout
        const cmd = pm === 'yarn'
            ? 'yarn audit --json'
            : 'npm audit --json --no-update-notifier';
        const execOpts = { cwd, timeout: 60_000, env: process.env };

        try {
            const { stdout } = await execAsync(cmd, execOpts);
            return { data: JSON.parse(stdout) };
        } catch (e: any) {
            // Exit code 1 + valid stdout JSON = vulnerabilities found (normal case)
            if (e.stdout) {
                try {
                    return { data: JSON.parse(e.stdout) };
                } catch { /* not valid JSON, fall through */ }
            }

            // Build a clean, useful error from stderr/stdout
            const raw = [e.stderr, e.stdout, e.message]
                .filter(Boolean)
                .join('\n');

            const clean = raw
                .split('\n')
                .filter(l =>
                    l.trim() &&
                    !l.includes('NODE_TLS_REJECT_UNAUTHORIZED') &&
                    !l.includes('Warning:') &&
                    !l.includes('npm warn') &&
                    !l.includes('node --trace-warnings'),
                )
                .slice(0, 5)   // keep first 5 meaningful lines
                .join('\n')
                .trim();

            // Diagnose common causes
            let hint = '';
            if (raw.includes('ENOTFOUND') || raw.includes('ECONNREFUSED') || raw.includes('ETIMEDOUT') || raw.includes('network')) {
                hint = 'Could not reach the npm registry. Check your network or proxy settings.';
            } else if (raw.includes('ELOCKFILECONFLICT') || raw.includes('package-lock')) {
                hint = 'Lock file issue. Try running npm install first.';
            } else if (raw.includes('not found') || raw.includes('not recognized')) {
                hint = 'npm not found in PATH.';
            }

            this.logger.warn(`npm audit failed: ${clean}`);
            return { data: null, error: hint || clean || 'npm audit failed' };
        }
    }

    private async runOutdated(
        cwd: string,
        pm: 'npm' | 'yarn' | 'pnpm',
    ): Promise<Record<string, OutdatedPackage>> {
        // npm outdated exits with code 1 when outdated packages are found
        const cmd = pm === 'yarn' ? 'yarn outdated --json' : 'npm outdated --json';
        const execOpts = { cwd, timeout: 30_000, env: process.env };

        try {
            const { stdout } = await execAsync(cmd, execOpts);
            return stdout ? JSON.parse(stdout) : {};
        } catch (e: any) {
            if (e.stdout) {
                try {
                    return JSON.parse(e.stdout);
                } catch { /* ignore */ }
            }
            return {};
        }
    }

    private detectPackageManager(cwd: string): 'npm' | 'yarn' | 'pnpm' {
        if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
        if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
        return 'npm';
    }

    private getEngines(cwd: string): Record<string, string> | null {
        try {
            const pkgPath = path.join(cwd, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            return pkg.engines || null;
        } catch {
            return null;
        }
    }

    private async getNpmVersion(): Promise<string> {
        try {
            const { stdout } = await execAsync('npm --version', { timeout: 5_000 });
            return stdout.trim();
        } catch {
            return 'unknown';
        }
    }
}

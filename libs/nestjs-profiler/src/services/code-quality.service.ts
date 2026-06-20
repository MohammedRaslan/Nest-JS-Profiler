import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface EslintMessage {
    ruleId: string | null;
    severity: 1 | 2;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    suggestions?: Array<{ desc: string }>;
    fixable: boolean;
}

export interface EslintFileResult {
    filePath: string;
    messages: EslintMessage[];
    errorCount: number;
    warningCount: number;
    fixableErrorCount: number;
    fixableWarningCount: number;
}

export interface TscError {
    filePath: string;
    line: number;
    column: number;
    severity: 'error' | 'warning';
    code: string;
    message: string;
}

export interface RuleSummary {
    ruleId: string;
    count: number;
    severity: number;
    files: string[];
}

export interface CodeQualityReport {
    eslint: {
        available: boolean;
        results: EslintFileResult[];
        totalErrors: number;
        totalWarnings: number;
        totalFixable: number;
        filesAffected: number;
        topRules: RuleSummary[];
        error?: string;
    };
    tsc: {
        available: boolean;
        errors: TscError[];
        totalErrors: number;
        totalWarnings: number;
        error?: string;
    };
    scannedAt: number;
    fromCache?: boolean;
}

@Injectable()
export class CodeQualityService {
    private readonly logger = new Logger(CodeQualityService.name);
    private cachedReport: CodeQualityReport | null = null;

    async runCheck(force = false): Promise<CodeQualityReport> {
        if (!force && this.cachedReport) {
            const age = Date.now() - this.cachedReport.scannedAt;
            if (age < CACHE_TTL_MS) {
                return { ...this.cachedReport, fromCache: true };
            }
        }

        const cwd = process.cwd();
        const [eslintResult, tscResult] = await Promise.all([
            this.runEslint(cwd),
            this.runTsc(cwd),
        ]);

        const report: CodeQualityReport = {
            eslint: eslintResult,
            tsc: tscResult,
            scannedAt: Date.now(),
        };

        this.cachedReport = report;
        return report;
    }

    private async runEslint(cwd: string): Promise<CodeQualityReport['eslint']> {
        // Use local binary if present, otherwise fall back to npx
        const localBin = path.join(cwd, 'node_modules', '.bin', 'eslint');
        const bin = fs.existsSync(localBin) ? localBin : 'npx eslint';
        // Target src/ if it exists, otherwise the whole project root
        const target = fs.existsSync(path.join(cwd, 'src')) ? 'src' : '.';
        // Ignore compiled output and other generated dirs
        const ignores = ['dist', 'build', 'coverage', '.next', 'out']
            .map(d => `--ignore-pattern '${d}/**'`)
            .join(' ');
        const cmd = `${bin} --format json ${ignores} ${target}`;
        const execOpts = { cwd, timeout: 120_000, maxBuffer: 100 * 1024 * 1024, env: process.env };

        try {
            const { stdout } = await execAsync(cmd, execOpts);
            const results = JSON.parse(stdout);
            return this.processEslintResults(results, cwd);
        } catch (e: any) {
            // eslint exits 1 when issues found — stdout still has valid JSON
            if (e.stdout) {
                try {
                    const results = JSON.parse(e.stdout);
                    return this.processEslintResults(results, cwd);
                } catch { /* fall through */ }
            }
            this.logger.warn(`ESLint failed: ${e.message}`);
            return {
                available: false,
                results: [],
                totalErrors: 0,
                totalWarnings: 0,
                totalFixable: 0,
                filesAffected: 0,
                topRules: [],
                error: e.message,
            };
        }
    }

    private processEslintResults(raw: any[], cwd: string): CodeQualityReport['eslint'] {
        const results: EslintFileResult[] = raw
            .filter(r => r.messages && r.messages.length > 0)
            .map(r => ({
                filePath: path.relative(cwd, r.filePath),
                messages: (r.messages as any[]).map(m => ({
                    ruleId: m.ruleId || null,
                    severity: m.severity as 1 | 2,
                    message: m.message,
                    line: m.line,
                    column: m.column,
                    endLine: m.endLine,
                    endColumn: m.endColumn,
                    fixable: !!m.fix,
                    suggestions: m.suggestions?.map((s: any) => ({ desc: s.desc })),
                })),
                errorCount: r.errorCount,
                warningCount: r.warningCount,
                fixableErrorCount: r.fixableErrorCount || 0,
                fixableWarningCount: r.fixableWarningCount || 0,
            }));

        const totalErrors = results.reduce((s, r) => s + r.errorCount, 0);
        const totalWarnings = results.reduce((s, r) => s + r.warningCount, 0);
        const totalFixable = results.reduce((s, r) => s + r.fixableErrorCount + r.fixableWarningCount, 0);

        // Aggregate by rule
        const ruleMap = new Map<string, { count: number; severity: number; files: Set<string> }>();
        results.forEach(r => {
            r.messages.forEach(m => {
                if (!m.ruleId) return;
                const entry = ruleMap.get(m.ruleId) || { count: 0, severity: m.severity, files: new Set() };
                entry.count++;
                entry.severity = Math.max(entry.severity, m.severity);
                entry.files.add(r.filePath);
                ruleMap.set(m.ruleId, entry);
            });
        });

        const topRules: RuleSummary[] = Array.from(ruleMap.entries())
            .map(([ruleId, { count, severity, files }]) => ({ ruleId, count, severity, files: Array.from(files) }))
            .sort((a, b) => b.severity - a.severity || b.count - a.count)
            .slice(0, 30);

        return {
            available: true,
            results,
            totalErrors,
            totalWarnings,
            totalFixable,
            filesAffected: results.length,
            topRules,
        };
    }

    private async runTsc(cwd: string): Promise<CodeQualityReport['tsc']> {
        if (!fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
            return { available: false, errors: [], totalErrors: 0, totalWarnings: 0, error: 'No tsconfig.json found' };
        }

        try {
            // || true prevents exec from throwing on non-zero exit
            const localTsc = path.join(cwd, 'node_modules', '.bin', 'tsc');
            const tscBin = fs.existsSync(localTsc) ? localTsc : 'npx tsc';
            const { stdout } = await execAsync(`${tscBin} --noEmit 2>&1 || true`, { cwd, timeout: 120_000, maxBuffer: 100 * 1024 * 1024, env: process.env });
            const errors = this.parseTscOutput(stdout, cwd);
            return {
                available: true,
                errors,
                totalErrors: errors.filter(e => e.severity === 'error').length,
                totalWarnings: errors.filter(e => e.severity === 'warning').length,
            };
        } catch (e: any) {
            const out = e.stdout || e.stderr || '';
            if (out) {
                const errors = this.parseTscOutput(out, cwd);
                return {
                    available: true,
                    errors,
                    totalErrors: errors.filter(e => e.severity === 'error').length,
                    totalWarnings: errors.filter(e => e.severity === 'warning').length,
                };
            }
            return { available: false, errors: [], totalErrors: 0, totalWarnings: 0, error: e.message };
        }
    }

    private parseTscOutput(output: string, cwd: string): TscError[] {
        const errors: TscError[] = [];
        // Matches: path/to/file.ts(10,5): error TS2345: message
        const pattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
        let match;
        while ((match = pattern.exec(output)) !== null) {
            const [, filePath, line, col, severity, code, message] = match;
            try {
                errors.push({
                    filePath: path.relative(cwd, path.resolve(cwd, filePath.trim())),
                    line: parseInt(line),
                    column: parseInt(col),
                    severity: severity as 'error' | 'warning',
                    code,
                    message: message.trim(),
                });
            } catch { /* skip unparseable lines */ }
        }
        return errors;
    }
}

import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import * as pg from 'pg';
import { ProfilerService } from '../services/profiler.service';
import { ExplainAnalyzer } from '../analyzers/explain-analyzer';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import { QueryProfile } from '../common/profiler.model';
import { Client } from 'pg';

@Injectable()
export class PostgresCollector implements OnModuleInit {
    private logger = new Logger(PostgresCollector.name);
    private originalQuery: any;

    constructor(
        private profiler: ProfilerService,
        private explainAnalyzer: ExplainAnalyzer,
        @Inject('PROFILER_OPTIONS') private options: ProfilerOptions
    ) { }

    onModuleInit() {
        try {
            this.logger.debug(`Resolved pg package at: ${require.resolve('pg')}`);
        } catch (e) { }
        this.patchPg();
    }

    private patchPg() {
        const self = this;
        const pgDriver = this.options.pgDriver || pg;
        const client = pgDriver.Client;

        if ((client.prototype.query as any).__isPatched) {
            this.logger.debug('PostgreSQL Client already patched - skipping re-patching');
            return;
        }

        this.logger.log(`Initializing PostgreSQL Profiler: Patching ${this.options.pgDriver ? 'INJECTED' : 'LOCAL'} pg.Client.prototype.query`);
        this.originalQuery = client.prototype.query;

        if (!this.originalQuery) {
            this.logger.warn('Failed to patch PostgreSQL: Client.prototype.query is undefined');
            return;
        }

        client.prototype.query = function (this: pg.Client, ...args: any[]) {
            const clientInstance = this;
            const startTime = Date.now();

            let queryText = '';
            let queryParams: any[] = [];
            let connectionName = 'unknown';

            try {
                const dbName = (clientInstance as any).database || (clientInstance as any).connectionParameters?.database || 'unknown';
                const dbHost = (clientInstance as any).host || (clientInstance as any).connectionParameters?.host || 'localhost';
                connectionName = `${dbName}@${dbHost}`;

                if (typeof args[0] === 'string') {
                    queryText = args[0];
                    if (args[1] instanceof Array) {
                        queryParams = args[1];
                    }
                } else if (typeof args[0] === 'object' && args[0] !== null) {
                    queryText = args[0].text || '';
                    queryParams = args[0].values || [];
                }
            } catch (e) {
                self.logger.error('Profiler query extraction failed', e);
            }

            if (process.env.PROFILER_DEBUG) {
                self.logger.debug('[PostgresCollector] Intercepted query call');
            }

            let callback: Function | undefined;
            if (args.length > 0) {
                const lastArg = args[args.length - 1];
                if (typeof lastArg === 'function') {
                    callback = lastArg;
                }
            }

            if (callback) {
                const originalCallback = callback;
                args[args.length - 1] = (err: Error, result: pg.QueryResult) => {
                    self.captureQuery(clientInstance, queryText, queryParams, connectionName, startTime, result ? result.rowCount : null, err);
                    originalCallback(err, result);
                };
                return self.originalQuery.apply(this, args);
            } else {
                const resultPromise = self.originalQuery.apply(this, args);
                if (resultPromise && typeof resultPromise.then === 'function') {
                    return resultPromise.then(
                        (result: pg.QueryResult) => {
                            self.captureQuery(clientInstance, queryText, queryParams, connectionName, startTime, result ? result.rowCount : 0);
                            return result;
                        },
                        (err: Error) => {
                            self.captureQuery(clientInstance, queryText, queryParams, connectionName, startTime, 0, err);
                            throw err;
                        }
                    );
                }
                return resultPromise;
            }
        };

        (Client.prototype.query as any).__isPatched = true;
        this.logger.log('PostgreSQL Client.query successfully patched');
    }

    private captureQuery(
        clientInstance: any,
        queryText: string,
        queryParams: any[],
        connectionName: string,
        startTime: number,
        rowCount: number | null,
        err?: Error
    ) {
        try {
            const endTime = Date.now();
            const duration = endTime - startTime;

            const queryProfile: QueryProfile = {
                sql: queryText,
                params: queryParams,
                duration,
                startTime,
                rowCount: rowCount ?? undefined,
                error: err?.message,
                connection: connectionName,
                database: 'postgres',
            };

            const profile = this.profiler.getCurrentProfile();
            if (profile) {
                this.profiler.addQuery(queryProfile);

                // Run Explain if needed
                const explainConfig = this.options.explain;

                if (explainConfig?.enabled && duration >= (explainConfig.thresholdMs || 0)) {
                    // Only explain if text is valid
                    const isExplainable = queryText && /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(queryText) && !/^\s*EXPLAIN/i.test(queryText);

                    if (isExplainable) {
                        this.explainAnalyzer.analyze(clientInstance, queryText, queryParams, explainConfig.analyze)
                            .then(plan => {
                                if (plan) {
                                    queryProfile.explainPlan = plan;
                                    const planString = JSON.stringify(plan).toLowerCase();
                                    if (planString.includes('seq scan')) {
                                        if (!queryProfile.tags) queryProfile.tags = [];
                                        queryProfile.tags.push('seq-scan');
                                        queryProfile.planType = 'Seq Scan';
                                    } else if (planString.includes('index scan') || planString.includes('index only scan')) {
                                        queryProfile.planType = 'Index Scan';
                                    }
                                }
                            })
                            .catch(e => {
                                this.logger.error('Profiler explain failed', e);
                            });
                    }
                }
            } else if (process.env.PROFILER_DEBUG) {
                this.logger.debug(`Query captured OUTSIDE request context: ${(queryText || 'UNKNOWN').substring(0, 50)}...`);
            }
        } catch (e) {
            this.logger.error('Profiler capture failed', e);
        }
    }
}

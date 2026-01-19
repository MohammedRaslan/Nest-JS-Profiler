import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import type { QueryProfile } from '../common/profiler.model';

@Injectable()
export class MysqlCollector implements OnModuleInit {
    private logger = new Logger(MysqlCollector.name);
    private mysql: any;

    constructor(
        private profiler: ProfilerService,
        @Inject('PROFILER_OPTIONS') private options: ProfilerOptions
    ) { }

    onModuleInit() {
        if (this.options.collectMysql === false) {
            return;
        }

        try {
            // Try to get mysql2 from options or require it
            this.mysql = this.options.mysqlDriver || require('mysql2');
            this.patchMysql();
            this.logger.log('MysqlCollector initialized: Patching mysql2 driver');
        } catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND') {
                this.logger.debug('mysql2 driver not found, skipping MySQL profiling');
            } else {
                this.logger.error('Failed to initialize MysqlCollector', e);
            }
        }
    }

    private patchMysql() {
        if (!this.mysql || !this.mysql.Connection) {
            this.logger.warn('mysql2.Connection not found, cannot patch');
            return;
        }

        const self = this;
        const Connection = this.mysql.Connection;
        const originalQuery = Connection.prototype.query;

        if (!originalQuery) {
            this.logger.warn('Connection.prototype.query not found');
            return;
        }

        Connection.prototype.query = function (...args: any[]) {
            const startTime = Date.now();

            // Extract connection info
            const config = this.config || {};
            const dbName = config.database || 'unknown';
            const host = config.host || 'localhost';
            const port = config.port || 3306;
            const connectionName = `${dbName}@${host}:${port}`;

            // Extract SQL and params
            let sql = '';
            let params: any[] = [];
            let callback: any;

            // mysql2 query can be called in multiple ways:
            // query(sql, callback)
            // query(sql, values, callback)
            // query(options, callback)
            // query(options, values, callback)

            if (typeof args[0] === 'string') {
                sql = args[0];
                if (Array.isArray(args[1])) {
                    params = args[1];
                    callback = args[2];
                } else if (typeof args[1] === 'function') {
                    callback = args[1];
                }
            } else if (typeof args[0] === 'object') {
                sql = args[0].sql || '';
                params = args[0].values || [];
                callback = args[1];
            }

            // Wrap callback to capture results
            const wrappedCallback = function (err: any, results: any, fields: any) {
                const endTime = Date.now();
                const duration = endTime - startTime;

                // Extract row count
                let rowCount: number | undefined;
                if (results) {
                    if (Array.isArray(results)) {
                        rowCount = results.length;
                    } else if (results.affectedRows !== undefined) {
                        rowCount = results.affectedRows;
                    }
                }

                const queryProfile: QueryProfile = {
                    sql,
                    params: params.length > 0 ? params : undefined,
                    duration,
                    startTime,
                    rowCount,
                    connection: connectionName,
                    database: 'mysql',
                    error: err ? String(err.message || err) : undefined,
                };

                self.profiler.addQuery(queryProfile);

                // Call original callback if provided
                if (callback) {
                    callback(err, results, fields);
                }
            };

            // Replace callback in args
            if (typeof args[0] === 'string') {
                if (Array.isArray(args[1])) {
                    args[2] = wrappedCallback;
                } else {
                    args[1] = wrappedCallback;
                }
            } else {
                args[1] = wrappedCallback;
            }

            // Call original query
            return originalQuery.apply(this, args);
        };
    }
}

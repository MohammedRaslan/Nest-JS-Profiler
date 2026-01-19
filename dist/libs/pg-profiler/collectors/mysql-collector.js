"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MysqlCollector_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlCollector = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("../services/profiler.service");
let MysqlCollector = MysqlCollector_1 = class MysqlCollector {
    profiler;
    options;
    logger = new common_1.Logger(MysqlCollector_1.name);
    mysql;
    constructor(profiler, options) {
        this.profiler = profiler;
        this.options = options;
    }
    onModuleInit() {
        if (this.options.collectMysql === false) {
            return;
        }
        try {
            this.mysql = this.options.mysqlDriver || require('mysql2');
            this.patchMysql();
            this.logger.log('MysqlCollector initialized: Patching mysql2 driver');
        }
        catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                this.logger.debug('mysql2 driver not found, skipping MySQL profiling');
            }
            else {
                this.logger.error('Failed to initialize MysqlCollector', e);
            }
        }
    }
    patchMysql() {
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
        Connection.prototype.query = function (...args) {
            const startTime = Date.now();
            const config = this.config || {};
            const dbName = config.database || 'unknown';
            const host = config.host || 'localhost';
            const port = config.port || 3306;
            const connectionName = `${dbName}@${host}:${port}`;
            let sql = '';
            let params = [];
            let callback;
            if (typeof args[0] === 'string') {
                sql = args[0];
                if (Array.isArray(args[1])) {
                    params = args[1];
                    callback = args[2];
                }
                else if (typeof args[1] === 'function') {
                    callback = args[1];
                }
            }
            else if (typeof args[0] === 'object') {
                sql = args[0].sql || '';
                params = args[0].values || [];
                callback = args[1];
            }
            const wrappedCallback = function (err, results, fields) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                let rowCount;
                if (results) {
                    if (Array.isArray(results)) {
                        rowCount = results.length;
                    }
                    else if (results.affectedRows !== undefined) {
                        rowCount = results.affectedRows;
                    }
                }
                const queryProfile = {
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
                if (callback) {
                    callback(err, results, fields);
                }
            };
            if (typeof args[0] === 'string') {
                if (Array.isArray(args[1])) {
                    args[2] = wrappedCallback;
                }
                else {
                    args[1] = wrappedCallback;
                }
            }
            else {
                args[1] = wrappedCallback;
            }
            return originalQuery.apply(this, args);
        };
    }
};
exports.MysqlCollector = MysqlCollector;
exports.MysqlCollector = MysqlCollector = MysqlCollector_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('PROFILER_OPTIONS')),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService, Object])
], MysqlCollector);
//# sourceMappingURL=mysql-collector.js.map
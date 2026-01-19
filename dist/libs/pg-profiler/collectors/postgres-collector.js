"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PostgresCollector_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresCollector = void 0;
const common_1 = require("@nestjs/common");
const pg = __importStar(require("pg"));
const profiler_service_1 = require("../services/profiler.service");
const explain_analyzer_1 = require("../analyzers/explain-analyzer");
let PostgresCollector = PostgresCollector_1 = class PostgresCollector {
    profiler;
    explainAnalyzer;
    options;
    logger = new common_1.Logger(PostgresCollector_1.name);
    originalQuery;
    constructor(profiler, explainAnalyzer, options) {
        this.profiler = profiler;
        this.explainAnalyzer = explainAnalyzer;
        this.options = options;
    }
    onModuleInit() {
        try {
            this.logger.debug(`Resolved pg package at: ${require.resolve('pg')}`);
        }
        catch (e) { }
        this.patchPg();
    }
    patchPg() {
        const self = this;
        const pgDriver = this.options.pgDriver || pg;
        const Client = pgDriver.Client;
        if (Client.prototype.query.__isPatched) {
            this.logger.debug('PostgreSQL Client already patched - skipping re-patching');
            return;
        }
        this.logger.log(`Initializing PostgreSQL Profiler: Patching ${this.options.pgDriver ? 'INJECTED' : 'LOCAL'} pg.Client.prototype.query`);
        this.originalQuery = Client.prototype.query;
        Client.prototype.query = function (...args) {
            const clientInstance = this;
            const startTime = Date.now();
            const dbName = clientInstance.database || clientInstance.connectionParameters?.database || 'unknown';
            const dbHost = clientInstance.host || clientInstance.connectionParameters?.host || 'localhost';
            const connectionName = `${dbName}@${dbHost}`;
            if (process.env.PROFILER_DEBUG) {
                console.log('[PostgresCollector] Intercepted query call');
            }
            let queryText = '';
            let queryParams = [];
            let callback;
            if (typeof args[0] === 'string') {
                queryText = args[0];
                if (args[1] instanceof Array) {
                    queryParams = args[1];
                    if (typeof args[2] === 'function')
                        callback = args[2];
                }
                else if (typeof args[1] === 'function') {
                    callback = args[1];
                }
            }
            else if (typeof args[0] === 'object') {
                queryText = args[0].text;
                queryParams = args[0].values;
                if (typeof args[1] === 'function') {
                    callback = args[1];
                }
            }
            const captureQuery = (rowCount, err) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                const queryProfile = {
                    sql: queryText,
                    params: queryParams,
                    duration,
                    startTime,
                    rowCount: rowCount ?? undefined,
                    error: err?.message,
                    connection: connectionName,
                    database: 'postgres',
                };
                const profile = self.profiler.getCurrentProfile();
                if (profile) {
                    self.profiler.addQuery(queryProfile);
                    const explainConfig = self.options.explain;
                    const isExplainable = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(queryText) && !/^\s*EXPLAIN/i.test(queryText);
                    if (explainConfig?.enabled && isExplainable && duration >= (explainConfig.thresholdMs || 0)) {
                        self.explainAnalyzer.analyze(clientInstance, queryText, queryParams, explainConfig.analyze)
                            .then(plan => {
                            if (plan) {
                                queryProfile.explainPlan = plan;
                                const planString = JSON.stringify(plan).toLowerCase();
                                if (planString.includes('seq scan')) {
                                    if (!queryProfile.tags)
                                        queryProfile.tags = [];
                                    queryProfile.tags.push('seq-scan');
                                    queryProfile.planType = 'Seq Scan';
                                }
                                else if (planString.includes('index scan') || planString.includes('index only scan')) {
                                    queryProfile.planType = 'Index Scan';
                                }
                            }
                        })
                            .catch(e => {
                        });
                    }
                }
                else {
                    self.logger.warn(`Query captured OUTSIDE request context: ${queryText.substring(0, 50)}...`);
                }
            };
            if (callback) {
                const originalCallback = callback;
                args[args.length - 1] = (err, result) => {
                    captureQuery(result ? result.rowCount : null, err);
                    originalCallback(err, result);
                };
                return self.originalQuery.apply(this, args);
            }
            else {
                const resultPromise = self.originalQuery.apply(this, args);
                if (resultPromise && typeof resultPromise.then === 'function') {
                    return resultPromise.then((result) => {
                        captureQuery(result ? result.rowCount : 0);
                        return result;
                    }, (err) => {
                        captureQuery(0, err);
                        throw err;
                    });
                }
                return resultPromise;
            }
        };
        Client.prototype.query.__isPatched = true;
        this.logger.log('PostgreSQL Client.query successfully patched');
    }
};
exports.PostgresCollector = PostgresCollector;
exports.PostgresCollector = PostgresCollector = PostgresCollector_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)('PROFILER_OPTIONS')),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService,
        explain_analyzer_1.ExplainAnalyzer, Object])
], PostgresCollector);
//# sourceMappingURL=postgres-collector.js.map
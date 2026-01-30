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
var MongoCollector_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoCollector = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("../services/profiler.service");
let MongoCollector = MongoCollector_1 = class MongoCollector {
    profiler;
    options;
    logger = new common_1.Logger(MongoCollector_1.name);
    mongodb;
    constructor(profiler, options) {
        this.profiler = profiler;
        this.options = options;
    }
    onModuleInit() {
        if (this.options.collectMongo === false) {
            return;
        }
        try {
            this.mongodb = this.options.mongoDriver || require('mongodb');
            this.patchMongo();
            this.logger.log('MongoCollector initialized: Patching mongodb driver');
        }
        catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                this.logger.debug('mongodb driver not found, skipping MongoDB profiling');
            }
            else {
                this.logger.error('Failed to initialize MongoCollector', e);
            }
        }
    }
    patchMongo() {
        if (!this.mongodb) {
            this.logger.warn('MongoDB driver is undefined provided to MongoCollector');
            return;
        }
        if (!this.mongodb.Collection) {
            this.logger.warn(`mongodb.Collection not found on provided driver. Keys: ${Object.keys(this.mongodb).join(', ')}`);
            this.logger.warn('If you are using Mongoose, ensure you are passing the "mongodb" driver instance, not Mongoose itself.');
            return;
        }
        const self = this;
        const Collection = this.mongodb.Collection;
        const operations = [
            'find', 'findOne', 'insertOne', 'insertMany',
            'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
            'aggregate', 'countDocuments', 'replaceOne'
        ];
        this.logger.debug(`Patching MongoDB Collection methods: ${operations.join(', ')}`);
        operations.forEach(opName => {
            const originalMethod = Collection.prototype[opName];
            if (!originalMethod) {
                this.logger.warn(`Could not find method ${opName} on Collection.prototype`);
                return;
            }
            Collection.prototype[opName] = function (...args) {
                if (process.env.PROFILER_DEBUG) {
                    self.logger.debug(`Mongo Intercepted: ${opName}`);
                }
                const startTime = Date.now();
                const collectionName = this.collectionName || 'unknown';
                const dbName = this.s?.db?.databaseName || this.dbName || 'unknown';
                const client = this.s?.db?.s?.client;
                const host = client?.s?.options?.hosts?.[0] || 'localhost:27017';
                const connectionName = `${dbName}@${host}`;
                let filter = {};
                let operation = opName;
                if (['find', 'findOne', 'deleteOne', 'deleteMany', 'countDocuments'].includes(opName)) {
                    filter = args[0] || {};
                }
                else if (['updateOne', 'updateMany', 'replaceOne'].includes(opName)) {
                    filter = args[0] || {};
                }
                else if (['insertOne', 'insertMany'].includes(opName)) {
                    filter = { document: args[0] };
                }
                else if (opName === 'aggregate') {
                    filter = { pipeline: args[0] || [] };
                }
                const result = originalMethod.apply(this, args);
                if (result && typeof result.then === 'function') {
                    return result.then((res) => {
                        const endTime = Date.now();
                        self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, res);
                        return res;
                    }).catch((err) => {
                        const endTime = Date.now();
                        self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, null, err);
                        throw err;
                    });
                }
                if (result && result.toArray) {
                    const originalToArray = result.toArray;
                    result.toArray = function () {
                        const arrayPromise = originalToArray.apply(this, arguments);
                        return arrayPromise.then((docs) => {
                            const endTime = Date.now();
                            self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, { docs });
                            return docs;
                        }).catch((err) => {
                            const endTime = Date.now();
                            self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, null, err);
                            throw err;
                        });
                    };
                }
                return result;
            };
        });
    }
    captureQuery(operation, collection, filter, startTime, endTime, connectionName, result, error) {
        try {
            const queryText = JSON.stringify({
                collection,
                operation,
                filter
            }, null, 2);
            let rowCount;
            if (result) {
                if (result.docs)
                    rowCount = result.docs.length;
                else if (result.insertedCount)
                    rowCount = result.insertedCount;
                else if (result.modifiedCount)
                    rowCount = result.modifiedCount;
                else if (result.deletedCount)
                    rowCount = result.deletedCount;
                else if (typeof result === 'number')
                    rowCount = result;
            }
            const queryProfile = {
                sql: queryText,
                query: queryText,
                database: 'mongodb',
                operation,
                filter,
                duration: endTime - startTime,
                startTime,
                rowCount,
                connection: connectionName,
                error: error ? String(error) : undefined,
            };
            this.profiler.addQuery(queryProfile);
        }
        catch (e) {
            if (process.env.PROFILER_DEBUG) {
                this.logger.error('Failed to capture MongoDB query', e);
            }
        }
    }
};
exports.MongoCollector = MongoCollector;
exports.MongoCollector = MongoCollector = MongoCollector_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('PROFILER_OPTIONS')),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService, Object])
], MongoCollector);
//# sourceMappingURL=mongo-collector.js.map
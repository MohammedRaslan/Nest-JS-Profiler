import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ProfilerService } from '../services/profiler.service';
import type { ProfilerOptions } from '../common/profiler-options.interface';
import type { QueryProfile } from '../common/profiler.model';

@Injectable()
export class MongoCollector implements OnModuleInit {
    private logger = new Logger(MongoCollector.name);
    private mongodb: any;

    constructor(
        private profiler: ProfilerService,
        @Inject('PROFILER_OPTIONS') private options: ProfilerOptions
    ) { }

    onModuleInit() {
        if (this.options.collectMongo === false) {
            return;
        }

        try {
            this.mongodb = this.options.mongoDriver || require('mongodb');
            this.patchMongo();
            this.logger.log('MongoCollector initialized: Patching mongodb driver');
        } catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND') {
                this.logger.debug('mongodb driver not found, skipping MongoDB profiling');
            } else {
                this.logger.error('Failed to initialize MongoCollector', e);
            }
        }
    }

    private patchMongo() {
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
        const collection = this.mongodb.Collection;


        const operations = [
            'find', 'findOne', 'insertOne', 'insertMany',
            'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
            'aggregate', 'countDocuments', 'replaceOne'
        ];

        this.logger.debug(`Patching MongoDB Collection methods: ${operations.join(', ')}`);

        operations.forEach(opName => {
            const originalMethod = collection.prototype[opName];
            if (!originalMethod) {
                this.logger.warn(`Could not find method ${opName} on Collection.prototype`);
                return;
            }

            collection.prototype[opName] = function (...args: any[]) {
                if (process.env.PROFILER_DEBUG) {
                    self.logger.debug(`Mongo Intercepted: ${opName}`);
                }
                const startTime = Date.now();
                const collectionName = this.collectionName || 'unknown';
                const dbName = this.s?.db?.databaseName || this.dbName || 'unknown';

                const client = this.s?.db?.s?.client;
                const host = client?.s?.options?.hosts?.[0] || 'localhost:27017';
                const connectionName = `${dbName}@${host}`;

                let filter: any = {};
                let operation = opName;

                filter = self.buildFilter(opName, args);

                const result = originalMethod.apply(this, args);

                if (result && typeof result.then === 'function') {
                    return result.then((res: any) => {
                        const endTime = Date.now();
                        self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, res);
                        return res;
                    }).catch((err: any) => {
                        const endTime = Date.now();
                        self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, null, err);
                        throw err;
                    });
                }

                if (result && result.toArray) {
                    const originalToArray = result.toArray;
                    result.toArray = function () {
                        const arrayPromise = originalToArray.apply(this, arguments);
                        return arrayPromise.then((docs: any[]) => {
                            const endTime = Date.now();
                            self.captureQuery(operation, collectionName, filter, startTime, endTime, connectionName, { docs });
                            return docs;
                        }).catch((err: any) => {
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

    private handleQueryOperation(opName: string, args: any[]): any | null {
        const operations = [
            'find',
            'findOne',
            'deleteOne',
            'deleteMany',
            'countDocuments',
            'updateOne',
            'updateMany',
            'replaceOne',
        ];

        if (!operations.includes(opName)) {
            return null;
        }

        return args[0] || {};
    }

    private handleInsertOperation(opName: string, args: any[]): any | null {
        if (!['insertOne', 'insertMany'].includes(opName)) {
            return null;
        }

        return {
            document: args[0],
        };
    }

    private handleAggregateOperation(opName: string, args: any[]): any | null {
        if (opName !== 'aggregate') {
            return null;
        }

        return {
            pipeline: args[0] || [],
        };
    }

    private buildFilter(opName: string, args: any[]): any {
        return (
            this.handleQueryOperation(opName, args) ??
            this.handleInsertOperation(opName, args) ??
            this.handleAggregateOperation(opName, args) ??
            {}
        );
    }

    private captureQuery(
        operation: string,
        collection: string,
        filter: any,
        startTime: number,
        endTime: number,
        connectionName: string,
        result?: any,
        error?: any
    ) {
        try {
            const queryText = JSON.stringify({
                collection,
                operation,
                filter
            }, null, 2);

            const rowCount = this.getRowCount(result);

            const queryProfile: QueryProfile = {
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
        } catch (e) {
            if (process.env.PROFILER_DEBUG) {
                this.logger.error('Failed to capture MongoDB query', e);
            }
        }
    }

    private rowCountResolvers: Array<(result: any) => number | null> = [
        (r) => (typeof r === 'number' ? r : null),
        (r) => (Array.isArray(r.docs) ? r.docs.length : null),
        (r) => r.insertedCount ?? null,
        (r) => r.modifiedCount ?? null,
        (r) => r.deletedCount ?? null,
    ];

    private getRowCount(result: any): number {
        for (const resolver of this.rowCountResolvers) {
            const value = resolver(result);
            if (value !== null && value !== undefined) {
                return value;
            }
        }

        return 0;
    }
}

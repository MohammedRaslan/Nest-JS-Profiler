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
            // Try to get mongodb from options or require it
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
        const Collection = this.mongodb.Collection;

        // Operations to intercept
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

            Collection.prototype[opName] = function (...args: any[]) {
                if (process.env.PROFILER_DEBUG) {
                    self.logger.debug(`Mongo Intercepted: ${opName}`);
                }
                const startTime = Date.now();
                const collectionName = this.collectionName || 'unknown';
                const dbName = this.s?.db?.databaseName || this.dbName || 'unknown';

                // Extract connection info
                const client = this.s?.db?.s?.client;
                const host = client?.s?.options?.hosts?.[0] || 'localhost:27017';
                const connectionName = `${dbName}@${host}`;

                // Extract filter/query from args
                let filter: any = {};
                let operation = opName;

                // Different operations have different arg structures
                if (['find', 'findOne', 'deleteOne', 'deleteMany', 'countDocuments'].includes(opName)) {
                    filter = args[0] || {};
                } else if (['updateOne', 'updateMany', 'replaceOne'].includes(opName)) {
                    filter = args[0] || {};
                } else if (['insertOne', 'insertMany'].includes(opName)) {
                    filter = { document: args[0] };
                } else if (opName === 'aggregate') {
                    filter = { pipeline: args[0] || [] };
                }

                // Call original method
                const result = originalMethod.apply(this, args);

                // Handle promise-based results
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

                // Handle cursor-based results (find returns cursor)
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
            // Format query as JSON string
            const queryText = JSON.stringify({
                collection,
                operation,
                filter
            }, null, 2);

            // Extract result count
            let rowCount: number | undefined;
            if (result) {
                if (result.docs) rowCount = result.docs.length;
                else if (result.insertedCount) rowCount = result.insertedCount;
                else if (result.modifiedCount) rowCount = result.modifiedCount;
                else if (result.deletedCount) rowCount = result.deletedCount;
                else if (typeof result === 'number') rowCount = result;
            }

            const queryProfile: QueryProfile = {
                sql: queryText, // Store formatted JSON in sql field
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
            // Silently fail to avoid breaking app
            if (process.env.PROFILER_DEBUG) {
                this.logger.error('Failed to capture MongoDB query', e);
            }
        }
    }
}

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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityExplorerService = void 0;
const common_1 = require("@nestjs/common");
let EntityExplorerService = class EntityExplorerService {
    entities = [];
    constructor() { }
    initialize(modulesContainer) {
        try {
            this.scan(modulesContainer);
        }
        catch (e) {
            console.error('Profiler: Entity discovery failed', e);
        }
    }
    getEntities() {
        return this.entities;
    }
    scan(modulesContainer) {
        if (!modulesContainer)
            return;
        const definitions = [];
        const modules = [...modulesContainer.values()];
        for (const module of modules) {
            const providers = [...module.providers.values()];
            for (const provider of providers) {
                if (!provider.instance)
                    continue;
                if (this.isTypeOrmDataSource(provider.instance)) {
                    definitions.push(...this.extractTypeOrmEntities(provider.instance));
                }
                if (this.isMongooseConnection(provider.instance)) {
                    definitions.push(...this.extractMongooseModels(provider.instance));
                }
            }
        }
        const unique = new Map();
        definitions.forEach(d => {
            const key = `${d.connection}:${d.name}`;
            unique.set(key, d);
        });
        this.entities = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
    isTypeOrmDataSource(instance) {
        return (instance &&
            typeof instance === 'object' &&
            instance.entityMetadatas &&
            Array.isArray(instance.entityMetadatas) &&
            instance.driver &&
            typeof instance.driver === 'object');
    }
    extractTypeOrmEntities(dataSource) {
        const entities = [];
        const connectionName = dataSource.name || 'default';
        const dbType = dataSource.options?.type || 'sql';
        const databaseName = dataSource.options?.database || 'unknown';
        for (const metadata of dataSource.entityMetadatas) {
            entities.push({
                name: metadata.name,
                type: dbType,
                database: databaseName,
                connection: connectionName,
                tableName: metadata.tableName,
                columns: metadata.columns?.map((c) => c.propertyName) || [],
            });
        }
        return entities;
    }
    isMongooseConnection(instance) {
        return (instance &&
            typeof instance === 'object' &&
            instance.models &&
            typeof instance.models === 'object' &&
            instance.base &&
            typeof instance.base === 'object');
    }
    extractMongooseModels(connection) {
        const entities = [];
        const connectionName = connection.name || 'default';
        const databaseName = connection.db?.databaseName || 'unknown';
        for (const [name, model] of Object.entries(connection.models)) {
            const schema = model.schema;
            const columns = schema && schema.paths ? Object.keys(schema.paths) : [];
            entities.push({
                name: name,
                type: 'mongodb',
                database: databaseName,
                connection: connectionName,
                tableName: model.collection?.name,
                columns: columns
            });
        }
        return entities;
    }
};
exports.EntityExplorerService = EntityExplorerService;
exports.EntityExplorerService = EntityExplorerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EntityExplorerService);
//# sourceMappingURL=entity-explorer.service.js.map
import { Injectable } from '@nestjs/common';

export interface EntityDefinition {
    name: string;
    type: string; // 'postgres' | 'mongodb' | 'other'
    database: string;
    connection: string;
    tableName?: string;
    columns?: string[];
}

@Injectable()
export class EntityExplorerService {
    private entities: EntityDefinition[] = [];

    constructor() { }

    /**
     * Manually initialize with ModulesContainer from the main app
     */
    initialize(modulesContainer: any) {
        try {
            this.scan(modulesContainer);
        } catch (e) {
            console.error('Profiler: Entity discovery failed', e);
        }
    }

    /**
     * Get discovered entities
     */
    getEntities(): EntityDefinition[] {
        return this.entities;
    }

    private scan(modulesContainer: Map<any, any>) {
        if (!modulesContainer) return;

        const definitions: EntityDefinition[] = [];
        const modules = [...modulesContainer.values()];

        for (const module of modules) {
            const providers = [...(module as any).providers.values()];

            for (const provider of providers) {
                if (!provider.instance) continue;

                // Check for TypeORM DataSource
                if (this.isTypeOrmDataSource(provider.instance)) {
                    definitions.push(...this.extractTypeOrmEntities(provider.instance));
                }

                // Check for Mongoose Connection
                if (this.isMongooseConnection(provider.instance)) {
                    definitions.push(...this.extractMongooseModels(provider.instance));
                }
            }
        }

        // Deduplicate
        const unique = new Map<string, EntityDefinition>();
        definitions.forEach(d => {
            const key = `${d.connection}:${d.name}`;
            unique.set(key, d);
        });

        this.entities = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    // Check if instance looks like TypeORM DataSource
    private isTypeOrmDataSource(instance: any): boolean {
        return (
            instance &&
            typeof instance === 'object' &&
            instance.entityMetadatas &&
            Array.isArray(instance.entityMetadatas) &&
            instance.driver &&
            typeof instance.driver === 'object'
        );
    }

    // Extract entities from TypeORM DataSource
    private extractTypeOrmEntities(dataSource: any): EntityDefinition[] {
        const entities: EntityDefinition[] = [];
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
                columns: metadata.columns?.map((c: any) => c.propertyName) || [],
            });
        }

        return entities;
    }

    // Check if instance looks like Mongoose Connection
    private isMongooseConnection(instance: any): boolean {
        return (
            instance &&
            typeof instance === 'object' &&
            instance.models &&
            typeof instance.models === 'object' &&
            instance.base &&
            typeof instance.base === 'object'
        );
    }

    // Extract models from Mongoose Connection
    private extractMongooseModels(connection: any): EntityDefinition[] {
        const entities: EntityDefinition[] = [];
        const connectionName = connection.name || 'default';
        const databaseName = connection.db?.databaseName || 'unknown';

        for (const [name, model] of Object.entries(connection.models)) {
            // Safe check for schema paths
            const schema: any = (model as any).schema;
            const columns = schema && schema.paths ? Object.keys(schema.paths) : [];

            entities.push({
                name: name,
                type: 'mongodb',
                database: databaseName,
                connection: connectionName,
                tableName: (model as any).collection?.name, // Collection name
                columns: columns
            });
        }

        return entities;
    }
}

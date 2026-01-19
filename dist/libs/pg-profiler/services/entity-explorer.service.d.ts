export interface EntityDefinition {
    name: string;
    type: string;
    database: string;
    connection: string;
    tableName?: string;
    columns?: string[];
}
export declare class EntityExplorerService {
    private entities;
    constructor();
    initialize(modulesContainer: any): void;
    getEntities(): EntityDefinition[];
    private scan;
    private isTypeOrmDataSource;
    private extractTypeOrmEntities;
    private isMongooseConnection;
    private extractMongooseModels;
}

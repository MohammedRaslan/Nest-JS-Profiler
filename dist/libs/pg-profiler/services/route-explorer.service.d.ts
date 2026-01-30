export interface RouteDefinition {
    path: string;
    method: string;
    controller: string;
    handler: string;
}
export declare class RouteExplorerService {
    private routes;
    constructor();
    initialize(modulesContainer: any, globalPrefix?: string): void;
    getRoutes(): RouteDefinition[];
    private scan;
    private normalizePath;
    private getRequestMethodName;
}

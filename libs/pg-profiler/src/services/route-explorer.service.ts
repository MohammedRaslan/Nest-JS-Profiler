import { Injectable, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

export interface RouteDefinition {
    path: string;
    method: string;
    controller: string;
    handler: string;
}

@Injectable()
export class RouteExplorerService {
    private routes: RouteDefinition[] = [];

    constructor() { }

    /**
     * Manually initialize with ModulesContainer from the main app
     */
    initialize(modulesContainer: any, globalPrefix: string = '') {
        try {
            this.scan(modulesContainer, globalPrefix);
        } catch (e) {
            console.error('Profiler: Route discovery failed', e);
        }
    }

    /**
     * Get discovered routes
     */
    getRoutes(): RouteDefinition[] {
        return this.routes;
    }

    private scan(modulesContainer: Map<any, any>, globalPrefix: string) {
        if (!modulesContainer) return;

        const routes: RouteDefinition[] = [];
        const modules = [...modulesContainer.values()];

        for (const module of modules) {
            const controllers = [...(module as any).controllers.values()];

            for (const controllerWrapper of controllers) {
                const controller = controllerWrapper.instance;
                const metadata = controllerWrapper.metatype;

                if (!controller || !metadata) continue;

                const controllerPath = Reflect.getMetadata(PATH_METADATA, metadata) || '';
                const prototype = Object.getPrototypeOf(controller);

                // Iterate over prototype methods
                Object.getOwnPropertyNames(prototype).forEach(methodName => {
                    if (methodName === 'constructor') return;

                    const handler = prototype[methodName];
                    const methodPath = Reflect.getMetadata(PATH_METADATA, handler);
                    const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);

                    if (requestMethod !== undefined) {
                        const fullPath = this.normalizePath(globalPrefix, controllerPath, methodPath);

                        routes.push({
                            path: fullPath,
                            method: this.getRequestMethodName(requestMethod),
                            controller: metadata.name,
                            handler: methodName
                        });
                    }
                });
            }
        }

        // Deduplicate and Sort
        const unique = new Map<string, RouteDefinition>();
        routes.forEach(r => unique.set(`${r.method}:${r.path}`, r));

        this.routes = Array.from(unique.values()).sort((a, b) => a.path.localeCompare(b.path));
    }

    private normalizePath(globalPrefix: string, controllerPath: any, methodPath: any): string {
        const parts = [globalPrefix, controllerPath, methodPath].map(p => {
            if (typeof p !== 'string') return '';
            return p.startsWith('/') ? p.substring(1) : p;
        }).filter(p => !!p);

        let path = '/' + parts.join('/');
        return path.replace(/\/+/g, '/'); // Ensure no double slashes
    }

    private getRequestMethodName(method: number): string {
        switch (method) {
            case RequestMethod.GET: return 'GET';
            case RequestMethod.POST: return 'POST';
            case RequestMethod.PUT: return 'PUT';
            case RequestMethod.DELETE: return 'DELETE';
            case RequestMethod.PATCH: return 'PATCH';
            case RequestMethod.OPTIONS: return 'OPTIONS';
            case RequestMethod.HEAD: return 'HEAD';
            case RequestMethod.ALL: return 'ALL';
            default: return 'UNKNOWN';
        }
    }
}

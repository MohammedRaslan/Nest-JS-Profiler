import { Injectable, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

export interface RouteParam {
    name: string;
    paramType: 'path' | 'query' | 'body' | 'header';
    dataType: string;
    required: boolean;
    properties?: RouteBodyProperty[];  // populated when dataType is a DTO class
    file?: string;                     // source file path of the DTO class
}

export interface RouteBodyProperty {
    name: string;
    type: string;
}

export interface RouteDefinition {
    path: string;
    method: string;
    controller: string;
    handler: string;
    params: RouteParam[];
    body?: {
        typeName: string;
        properties: RouteBodyProperty[];
        file?: string;  // source file path of the body DTO
    };
}

@Injectable()
export class RouteExplorerService {
    /**
     * Static so every DI instance shares the same data.
     * ProfilerModule registers this service in both the static @Module() and
     * the forRoot() dynamic module, which can produce two separate instances.
     * A static property guarantees initialize() (called on one instance) and
     * getRoutes() (called on possibly the other) always see the same array.
     */
    private static _routes: RouteDefinition[] = [];

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
        return RouteExplorerService._routes;
    }

    private scan(modulesContainer: Map<any, any>, globalPrefix: string) {
        if (!modulesContainer) return;

        const routes: RouteDefinition[] = [];
        const modules = [...modulesContainer.values()];

        for (const module of modules) {

            const controllersMap = (module as any).controllers;
            if (!controllersMap || typeof controllersMap.values !== 'function') continue;
            const controllers = [...controllersMap.values()];

            for (const controllerWrapper of controllers) {
                const controller = controllerWrapper.instance;
                const metadata = controllerWrapper.metatype;

                if (!controller || !metadata) continue;

                const controllerPath = Reflect.getMetadata(PATH_METADATA, metadata) || '';
                const prototype = Object.getPrototypeOf(controller);

                // Iterate over prototype methods
                Object.getOwnPropertyNames(prototype).forEach(methodName => {
                    if (methodName === 'constructor') return;

                    // Use getOwnPropertyDescriptor to avoid triggering getters.
                    // Reflect.getMetadata throws a TypeError if target is not an
                    // object, so we must verify the member is a plain function first.
                    let handler: any;
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
                        if (!descriptor || typeof descriptor.value !== 'function') return;
                        handler = descriptor.value;
                    } catch {
                        return;
                    }

                    const methodPath = Reflect.getMetadata(PATH_METADATA, handler);
                    const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);

                    if (requestMethod !== undefined) {
                        const fullPath = this.normalizePath(globalPrefix, controllerPath, methodPath);
                        const meta = this.extractHandlerMeta(prototype, methodName, fullPath);

                        routes.push({
                            path: fullPath,
                            method: this.getRequestMethodName(requestMethod),
                            controller: metadata.name,
                            handler: methodName,
                            ...meta,
                        });
                    }
                });
            }
        }

        // Deduplicate and Sort
        const unique = new Map<string, RouteDefinition>();
        routes.forEach(r => unique.set(`${r.method}:${r.path}`, r));

        RouteExplorerService._routes = Array.from(unique.values()).sort((a, b) => a.path.localeCompare(b.path));
    }

    private normalizePath(globalPrefix: string, controllerPath: any, methodPath: any): string {
        const parts = [globalPrefix, controllerPath, methodPath].map(p => {
            if (typeof p !== 'string') return '';
            return p.startsWith('/') ? p.substring(1) : p;
        }).filter(p => !!p);

        let path = '/' + parts.join('/');
        return path.replace(/\/+/g, '/'); // Ensure no double slashes
    }

    // ─── Parameter metadata extraction ───────────────────────────────────────

    /**
     * Extract path params, query params, headers and body info from NestJS
     * reflect-metadata on the handler.
     */
    private extractHandlerMeta(
        prototype: any,
        methodName: string,
        fullPath: string,
    ): { params: RouteParam[]; body?: { typeName: string; properties: RouteBodyProperty[] } } {
        try {
            // NestJS route-args metadata key
            const ROUTE_ARGS_KEY = '__routeArguments__';
            // RouteParamtypes enum from @nestjs/common/enums/route-paramtypes.enum.js
            // NOTE: These are NOT 0-based by decorator type — REQUEST=0, RESPONSE=1, NEXT=2
            //       come before the HTTP-parameter decorators.
            const RPT = { BODY: 3, QUERY: 4, PARAM: 5, HEADERS: 6 };

            const rawArgs: Record<string, any> =
                Reflect.getMetadata(ROUTE_ARGS_KEY, prototype.constructor, methodName) || {};
            const paramTypes: Function[] =
                Reflect.getMetadata('design:paramtypes', prototype, methodName) || [];

            const params: RouteParam[] = [];
            let bodyDef: { typeName: string; properties: RouteBodyProperty[] } | undefined;

            // Track which path-param names are already covered by @Param() decorators
            const coveredPathParams = new Set<string>();

            for (const key of Object.keys(rawArgs)) {
                const entry = rawArgs[key];

                // Custom param decorators (createParamDecorator) embed '__customRouteArgs__'
                // in their key: "${uid(21)}__customRouteArgs__:${index}".
                // Built-in decorators (@Body, @Param, @Query, @Headers) use the format
                // "${RouteParamtype}:${index}" with no suffix — safe to parseInt.
                if (key.includes('__customRouteArgs__')) continue;

                const typeNum = parseInt(key.split(':')[0], 10);
                if (isNaN(typeNum)) continue;

                const paramIndex: number = entry?.index ?? parseInt(key.split(':')[1], 10);
                const decoratorData: string | undefined = entry?.data; // e.g. 'id' in @Param('id')
                const tsType = paramTypes[paramIndex];
                const typeName = this.typeName(tsType);

                const PRIMITIVES = ['string', 'number', 'boolean', 'object', 'array', 'any'];
                const isPrimitive = PRIMITIVES.includes(typeName);

                if (typeNum === RPT.PARAM) {
                    // @Param() with no name injects the full params object — skip it;
                    // the URL-pattern scan below will add the individual :paramNames.
                    if (!decoratorData) continue;
                    const name = decoratorData;
                    coveredPathParams.add(name);
                    const props = !isPrimitive ? this.extractDtoProperties(tsType) : undefined;
                    const file = !isPrimitive ? this.findDtoFile(tsType) : undefined;
                    params.push({ name, paramType: 'path', dataType: typeName, required: true, ...(props?.length ? { properties: props } : {}), ...(file ? { file } : {}) });
                } else if (typeNum === RPT.QUERY) {
                    const name = decoratorData || `query${paramIndex}`;
                    const props = !isPrimitive ? this.extractDtoProperties(tsType) : undefined;
                    const file = !isPrimitive ? this.findDtoFile(tsType) : undefined;
                    params.push({ name, paramType: 'query', dataType: typeName, required: false, ...(props?.length ? { properties: props } : {}), ...(file ? { file } : {}) });
                } else if (typeNum === RPT.HEADERS) {
                    const name = decoratorData || 'headers';
                    const props = !isPrimitive ? this.extractDtoProperties(tsType) : undefined;
                    const file = !isPrimitive ? this.findDtoFile(tsType) : undefined;
                    params.push({ name, paramType: 'header', dataType: typeName, required: false, ...(props?.length ? { properties: props } : {}), ...(file ? { file } : {}) });
                } else if (typeNum === RPT.BODY) {
                    const file = !isPrimitive ? this.findDtoFile(tsType) : undefined;
                    bodyDef = {
                        typeName: typeName,
                        properties: isPrimitive ? [] : this.extractDtoProperties(tsType),
                        ...(file ? { file } : {}),
                    };
                }
            }

            // Add path params from the URL that weren't explicitly decorated with @Param()
            const urlPathParams = [...fullPath.matchAll(/:([^/]+)/g)].map(m => m[1]);
            for (const name of urlPathParams) {
                if (!coveredPathParams.has(name)) {
                    params.push({ name, paramType: 'path', dataType: 'string', required: true });
                }
            }

            return { params, body: bodyDef };
        } catch {
            return { params: [] };
        }
    }

    /**
     * Find the source (.ts) file for a DTO class by scanning require.cache.
     * Returns empty string if not found.
     */
    private findDtoFile(ctor: Function | undefined): string {
        if (!ctor?.name) return '';
        try {
            const cache = (require as any).cache as Record<string, any>;
            for (const [filename, mod] of Object.entries(cache)) {
                if (!mod?.exports) continue;
                const exp = mod.exports;
                if (exp[ctor.name] === ctor || exp?.default === ctor) {
                    return filename.replace(/\.js$/, '.ts');
                }
            }
        } catch { /* ignore */ }
        return '';
    }

    /** Resolve a TypeScript constructor to a plain type name string. */
    private typeName(ctor: Function | undefined): string {
        if (!ctor) return 'any';
        switch (ctor) {
            case String:  return 'string';
            case Number:  return 'number';
            case Boolean: return 'boolean';
            case Object:  return 'object';
            case Array:   return 'array';
            default:      return ctor.name || 'any';
        }
    }

    /**
     * Best-effort extraction of DTO properties.
     * Only returns properties that have at least one decorator (so design:type metadata
     * is present). Works with class-validator, @ApiProperty, or any other decorator.
     */
    private extractDtoProperties(ctor: Function | undefined): RouteBodyProperty[] {
        if (!ctor || typeof ctor !== 'function') return [];
        try {
            const proto = ctor.prototype;
            if (!proto) return [];

            return Object.getOwnPropertyNames(proto)
                .filter(name => name !== 'constructor')
                .map(name => {
                    const type = Reflect.getMetadata('design:type', proto, name);
                    return type ? { name, type: this.typeName(type) } : null;
                })
                .filter((p): p is RouteBodyProperty => p !== null);
        } catch {
            return [];
        }
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

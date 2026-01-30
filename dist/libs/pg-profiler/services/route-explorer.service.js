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
exports.RouteExplorerService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
let RouteExplorerService = class RouteExplorerService {
    routes = [];
    constructor() { }
    initialize(modulesContainer, globalPrefix = '') {
        try {
            this.scan(modulesContainer, globalPrefix);
        }
        catch (e) {
            console.error('Profiler: Route discovery failed', e);
        }
    }
    getRoutes() {
        return this.routes;
    }
    scan(modulesContainer, globalPrefix) {
        if (!modulesContainer)
            return;
        const routes = [];
        const modules = [...modulesContainer.values()];
        for (const module of modules) {
            const controllers = [...module.controllers.values()];
            for (const controllerWrapper of controllers) {
                const controller = controllerWrapper.instance;
                const metadata = controllerWrapper.metatype;
                if (!controller || !metadata)
                    continue;
                const controllerPath = Reflect.getMetadata(constants_1.PATH_METADATA, metadata) || '';
                const prototype = Object.getPrototypeOf(controller);
                Object.getOwnPropertyNames(prototype).forEach(methodName => {
                    if (methodName === 'constructor')
                        return;
                    const handler = prototype[methodName];
                    const methodPath = Reflect.getMetadata(constants_1.PATH_METADATA, handler);
                    const requestMethod = Reflect.getMetadata(constants_1.METHOD_METADATA, handler);
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
        const unique = new Map();
        routes.forEach(r => unique.set(`${r.method}:${r.path}`, r));
        this.routes = Array.from(unique.values()).sort((a, b) => a.path.localeCompare(b.path));
    }
    normalizePath(globalPrefix, controllerPath, methodPath) {
        const parts = [globalPrefix, controllerPath, methodPath].map(p => {
            if (typeof p !== 'string')
                return '';
            return p.startsWith('/') ? p.substring(1) : p;
        }).filter(p => !!p);
        let path = '/' + parts.join('/');
        return path.replace(/\/+/g, '/');
    }
    getRequestMethodName(method) {
        switch (method) {
            case common_1.RequestMethod.GET: return 'GET';
            case common_1.RequestMethod.POST: return 'POST';
            case common_1.RequestMethod.PUT: return 'PUT';
            case common_1.RequestMethod.DELETE: return 'DELETE';
            case common_1.RequestMethod.PATCH: return 'PATCH';
            case common_1.RequestMethod.OPTIONS: return 'OPTIONS';
            case common_1.RequestMethod.HEAD: return 'HEAD';
            case common_1.RequestMethod.ALL: return 'ALL';
            default: return 'UNKNOWN';
        }
    }
};
exports.RouteExplorerService = RouteExplorerService;
exports.RouteExplorerService = RouteExplorerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RouteExplorerService);
//# sourceMappingURL=route-explorer.service.js.map
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilerController = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("../services/profiler.service");
const view_service_1 = require("../services/view.service");
const template_builder_service_1 = require("../services/template-builder.service");
const entity_explorer_service_1 = require("../services/entity-explorer.service");
const route_explorer_service_1 = require("../services/route-explorer.service");
let ProfilerController = class ProfilerController {
    profilerService;
    viewService;
    templateBuilder;
    entityExplorer;
    routeExplorer;
    constructor(profilerService, viewService, templateBuilder, entityExplorer, routeExplorer) {
        this.profilerService = profilerService;
        this.viewService = viewService;
        this.templateBuilder = templateBuilder;
        this.entityExplorer = entityExplorer;
        this.routeExplorer = routeExplorer;
    }
    async dashboard(res) {
        const profiles = await this.profilerService.getDashboardData();
        const content = this.templateBuilder.buildDashboard(profiles);
        const html = this.viewService.renderWithLayout('Requests', content, 'requests');
        res.header('Content-Type', 'text/html');
        res.send(html);
    }
    async listJson() {
        return this.profilerService.getAllProfilesJson();
    }
    async debugQuery() {
        const { Client } = require('pg');
        const client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'postgres',
        });
        try {
            await client.connect();
            await client.query('SELECT 1 as test_query');
            await client.end();
            return { status: 'success', message: 'Query executed. Check profiler.' };
        }
        catch (e) {
            return {
                status: 'error',
                message: `Connection failed: ${e.message}`,
                tip: 'Pass correct credentials in URL: ?user=YOUR_USER&password=YOUR_PASS&database=YOUR_DB'
            };
        }
    }
    async detail(id, res) {
        const profile = await this.profilerService.getProfileDetail(id);
        if (!profile) {
            const content = this.templateBuilder.buildNotFound(id);
            const html = this.viewService.renderWithLayout('Profile Not Found', content);
            res.header('Content-Type', 'text/html');
            res.status(404).send(html);
            return;
        }
        const content = this.templateBuilder.buildDetail(profile);
        const html = this.viewService.renderWithLayout(`Request ${profile.id}`, content);
        res.header('Content-Type', 'text/html');
        res.send(html);
    }
    async detailJson(id) {
        const profile = await this.profilerService.getProfileJson(id);
        if (!profile)
            throw new common_1.NotFoundException('Profile not found');
        return profile;
    }
    async listQueries(res) {
        const queries = await this.profilerService.getQueriesList();
        const content = this.templateBuilder.buildQueriesList(queries);
        const html = this.viewService.renderWithLayout('Database Queries', content, 'queries');
        res.header('Content-Type', 'text/html');
        res.send(html);
    }
    async listLogs(res, page = 1) {
        const { logs, currentPage, totalPages, totalLogs } = await this.profilerService.getLogsList(page);
        const content = this.templateBuilder.buildLogsList(logs, currentPage, totalPages, totalLogs);
        const html = this.viewService.renderWithLayout('Application Logs', content, 'logs');
        res.header('Content-Type', 'text/html');
        res.send(html);
    }
    async listEntities(res) {
        const entities = this.entityExplorer.getEntities();
        const content = this.templateBuilder.buildEntitiesList(entities);
        const html = this.viewService.renderWithLayout('Entity Explorer', content, 'entities');
        res.header('Content-Type', 'text/html');
        res.send(html);
    }
    async listRoutes(res) {
        const routes = this.routeExplorer.getRoutes();
        const content = this.templateBuilder.buildRoutesList(routes);
        const html = this.viewService.renderWithLayout('Routes Explorer', content, 'routes');
        res.header('Content-Type', 'text/html');
        res.send(html);
    }
};
exports.ProfilerController = ProfilerController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('json'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "listJson", null);
__decorate([
    (0, common_1.Get)('debug/test-query'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "debugQuery", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/json'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "detailJson", null);
__decorate([
    (0, common_1.Get)('view/queries'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "listQueries", null);
__decorate([
    (0, common_1.Get)('view/logs'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "listLogs", null);
__decorate([
    (0, common_1.Get)('view/entities'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "listEntities", null);
__decorate([
    (0, common_1.Get)('view/routes'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfilerController.prototype, "listRoutes", null);
exports.ProfilerController = ProfilerController = __decorate([
    (0, common_1.Controller)('__profiler'),
    __metadata("design:paramtypes", [profiler_service_1.ProfilerService,
        view_service_1.ViewService,
        template_builder_service_1.TemplateBuilderService,
        entity_explorer_service_1.EntityExplorerService,
        route_explorer_service_1.RouteExplorerService])
], ProfilerController);
//# sourceMappingURL=profiler.controller.js.map
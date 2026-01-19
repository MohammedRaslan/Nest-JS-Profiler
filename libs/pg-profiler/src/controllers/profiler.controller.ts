import { Controller, Get, Param, Query, Inject, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ProfilerService } from '../services/profiler.service';
import { ViewService } from '../services/view.service';
import { TemplateBuilderService } from '../services/template-builder.service';
import { EntityExplorerService } from '../services/entity-explorer.service';

import { RouteExplorerService } from '../services/route-explorer.service';

@Controller('__profiler')
export class ProfilerController {
    constructor(
        private readonly profilerService: ProfilerService,
        private readonly viewService: ViewService,
        private readonly templateBuilder: TemplateBuilderService,
        private readonly entityExplorer: EntityExplorerService,
        private readonly routeExplorer: RouteExplorerService,
    ) { }

    @Get()
    async dashboard(@Res() res: Response) {
        const profiles = await this.profilerService.getDashboardData();
        const content = this.templateBuilder.buildDashboard(profiles);
        const html = this.viewService.renderWithLayout('Requests', content, 'requests');

        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    @Get('json')
    async listJson() {
        return this.profilerService.getAllProfilesJson();
    }

    @Get('debug/test-query')
    async debugQuery() {
        // Manual query test
        const { Client } = require('pg');
        const client = new Client({
            // Default connection
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
        } catch (e: any) {
            return {
                status: 'error',
                message: `Connection failed: ${e.message}`,
                tip: 'Pass correct credentials in URL: ?user=YOUR_USER&password=YOUR_PASS&database=YOUR_DB'
            };
        }
    }

    @Get(':id')
    async detail(@Param('id') id: string, @Res() res: Response) {
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

    @Get(':id/json')
    async detailJson(@Param('id') id: string) {
        const profile = await this.profilerService.getProfileJson(id);
        if (!profile) throw new NotFoundException('Profile not found');
        return profile;
    }

    @Get('view/queries')
    async listQueries(@Res() res: Response) {
        const queries = await this.profilerService.getQueriesList();
        const content = this.templateBuilder.buildQueriesList(queries);
        const html = this.viewService.renderWithLayout('Database Queries', content, 'queries');

        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    @Get('view/logs')
    async listLogs(@Res() res: Response, @Query('page') page: number = 1) {
        const { logs, currentPage, totalPages, totalLogs } = await this.profilerService.getLogsList(page);
        const content = this.templateBuilder.buildLogsList(logs, currentPage, totalPages, totalLogs);
        const html = this.viewService.renderWithLayout('Application Logs', content, 'logs');

        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    @Get('view/entities')
    async listEntities(@Res() res: Response) {
        const entities = this.entityExplorer.getEntities();
        const content = this.templateBuilder.buildEntitiesList(entities);
        const html = this.viewService.renderWithLayout('Entity Explorer', content, 'entities');

        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    @Get('view/routes')
    async listRoutes(@Res() res: Response) {
        const routes = this.routeExplorer.getRoutes();
        const content = this.templateBuilder.buildRoutesList(routes);
        const html = this.viewService.renderWithLayout('Routes Explorer', content, 'routes');

        res.header('Content-Type', 'text/html');
        res.send(html);
    }
}

import type { Response } from 'express';
import { ProfilerService } from '../services/profiler.service';
import { ViewService } from '../services/view.service';
import { TemplateBuilderService } from '../services/template-builder.service';
import { EntityExplorerService } from '../services/entity-explorer.service';
export declare class ProfilerController {
    private readonly profilerService;
    private readonly viewService;
    private readonly templateBuilder;
    private readonly entityExplorer;
    constructor(profilerService: ProfilerService, viewService: ViewService, templateBuilder: TemplateBuilderService, entityExplorer: EntityExplorerService);
    dashboard(res: Response): Promise<void>;
    listJson(): Promise<import("..").RequestProfile[]>;
    debugQuery(): Promise<{
        status: string;
        message: string;
        tip?: undefined;
    } | {
        status: string;
        message: string;
        tip: string;
    }>;
    detail(id: string, res: Response): Promise<void>;
    detailJson(id: string): Promise<import("..").RequestProfile>;
    listQueries(res: Response): Promise<void>;
    listLogs(res: Response, page?: number): Promise<void>;
    listEntities(res: Response): Promise<void>;
}

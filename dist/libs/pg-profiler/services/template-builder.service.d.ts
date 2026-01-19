import { RequestProfile } from '../common/profiler.model';
import { ViewService } from './view.service';
export declare class TemplateBuilderService {
    private readonly viewService;
    constructor(viewService: ViewService);
    buildDashboard(profiles: RequestProfile[]): string;
    buildDetail(profile: RequestProfile): string;
    private buildHeadersTable;
    private buildBodyView;
    private buildExceptionView;
    private buildTimingBar;
    buildQueriesList(queries: any[]): string;
    buildLogsList(logs: any[], currentPage: number, totalPages: number, totalLogs: number): string;
    buildEntitiesList(entities: any[]): string;
    buildNotFound(id: string): string;
    private buildRequestRow;
    private buildQueryDetail;
    private buildMetadataSidebar;
    private buildLogRow;
    private buildPagination;
    private getStatusColor;
}

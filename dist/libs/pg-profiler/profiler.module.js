"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProfilerModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilerModule = void 0;
const common_1 = require("@nestjs/common");
const profiler_service_1 = require("./services/profiler.service");
const view_service_1 = require("./services/view.service");
const template_builder_service_1 = require("./services/template-builder.service");
const entity_explorer_service_1 = require("./services/entity-explorer.service");
const postgres_collector_1 = require("./collectors/postgres-collector");
const mongo_collector_1 = require("./collectors/mongo-collector");
const mysql_collector_1 = require("./collectors/mysql-collector");
const log_collector_1 = require("./collectors/log-collector");
const explain_analyzer_1 = require("./analyzers/explain-analyzer");
const profiler_storage_interface_1 = require("./storage/profiler-storage.interface");
const profiler_controller_1 = require("./controllers/profiler.controller");
const request_profiler_interceptor_1 = require("./interceptors/request-profiler.interceptor");
const core_1 = require("@nestjs/core");
const profiler_logger_1 = require("./profiler-logger");
const profiler_middleware_1 = require("./middleware/profiler.middleware");
let ProfilerModule = ProfilerModule_1 = class ProfilerModule {
    configure(consumer) {
        consumer
            .apply(profiler_middleware_1.ProfilerMiddleware)
            .exclude({ path: '__profiler/(.*)', method: common_1.RequestMethod.ALL })
            .forRoutes({ path: '*', method: common_1.RequestMethod.ALL });
    }
    static forRoot(options = {}) {
        const optionsProvider = {
            provide: 'PROFILER_OPTIONS',
            useValue: options,
        };
        const storageProvider = {
            provide: 'PROFILER_STORAGE',
            useValue: typeof options.storage === 'object' && options.storage !== null
                ? options.storage
                : new profiler_storage_interface_1.InMemoryProfilerStorage(),
        };
        return {
            module: ProfilerModule_1,
            imports: [],
            providers: [
                optionsProvider,
                storageProvider,
                profiler_service_1.ProfilerService,
                view_service_1.ViewService,
                template_builder_service_1.TemplateBuilderService,
                entity_explorer_service_1.EntityExplorerService,
                postgres_collector_1.PostgresCollector,
                mongo_collector_1.MongoCollector,
                mysql_collector_1.MysqlCollector,
                log_collector_1.LogCollector,
                explain_analyzer_1.ExplainAnalyzer,
                {
                    provide: core_1.APP_INTERCEPTOR,
                    useClass: request_profiler_interceptor_1.RequestProfilerInterceptor,
                },
            ],
            exports: [profiler_service_1.ProfilerService],
        };
    }
    static initialize(app) {
        try {
            const explorer = app.get(entity_explorer_service_1.EntityExplorerService);
            const container = app.container;
            const modulesContainer = container.getModules();
            explorer.initialize(modulesContainer);
        }
        catch (e) {
            console.warn('Profiler: Could not initialize Entity Explorer. Ensure ProfilerModule is imported.', e);
        }
    }
};
exports.ProfilerModule = ProfilerModule;
exports.ProfilerModule = ProfilerModule = ProfilerModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [profiler_controller_1.ProfilerController],
        providers: [
            profiler_service_1.ProfilerService,
            profiler_logger_1.ProfilerLogger,
            view_service_1.ViewService,
            template_builder_service_1.TemplateBuilderService,
            entity_explorer_service_1.EntityExplorerService,
        ],
        exports: [
            profiler_service_1.ProfilerService,
            entity_explorer_service_1.EntityExplorerService,
        ],
    })
], ProfilerModule);
//# sourceMappingURL=profiler.module.js.map
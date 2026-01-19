import { DynamicModule, Module, Global, Provider, MiddlewareConsumer, RequestMethod, NestModule } from '@nestjs/common';
import { ProfilerOptions } from './common/profiler-options.interface';
import { ProfilerService } from './services/profiler.service';
import { ViewService } from './services/view.service';
import { TemplateBuilderService } from './services/template-builder.service';
import { EntityExplorerService } from './services/entity-explorer.service';
import { RouteExplorerService } from './services/route-explorer.service';
import { PostgresCollector } from './collectors/postgres-collector';
import { MongoCollector } from './collectors/mongo-collector';
import { MysqlCollector } from './collectors/mysql-collector';
import { LogCollector } from './collectors/log-collector';
import { ExplainAnalyzer } from './analyzers/explain-analyzer';
import { InMemoryProfilerStorage, ProfilerStorage } from './storage/profiler-storage.interface';
import { ProfilerController } from './controllers/profiler.controller';
import { RequestProfilerInterceptor } from './interceptors/request-profiler.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProfilerLogger } from './profiler-logger';
import { ProfilerMiddleware } from './middleware/profiler.middleware';

@Global()
@Module({
    controllers: [ProfilerController],
    providers: [
        ProfilerService,
        ProfilerLogger,
        ViewService,
        TemplateBuilderService,
        EntityExplorerService,
        RouteExplorerService,
    ],
    exports: [
        ProfilerService,
        EntityExplorerService,
        RouteExplorerService,
    ],
})
export class ProfilerModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(ProfilerMiddleware)
            .exclude({ path: '__profiler/(.*)', method: RequestMethod.ALL })
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }

    static forRoot(options: ProfilerOptions = {}): DynamicModule {
        const optionsProvider: Provider = {
            provide: 'PROFILER_OPTIONS',
            useValue: options,
        };

        const storageProvider: Provider = {
            provide: 'PROFILER_STORAGE',
            useValue:
                typeof options.storage === 'object' && options.storage !== null
                    ? options.storage
                    : new InMemoryProfilerStorage(),
        };

        return {
            module: ProfilerModule,
            imports: [],
            providers: [
                optionsProvider,
                storageProvider,
                ProfilerService,
                ViewService,
                TemplateBuilderService,
                EntityExplorerService,
                RouteExplorerService,
                PostgresCollector,
                MongoCollector,
                MysqlCollector,
                LogCollector,
                ExplainAnalyzer,
                {
                    provide: APP_INTERCEPTOR,
                    useClass: RequestProfilerInterceptor,
                },
            ],
            exports: [ProfilerService],
        };
    }

    /**
     * Initialize the Entity & Route Explorer manually
     * Call this in your bootstrap function: ProfilerModule.initialize(app);
     */
    static initialize(app: any) {
        try {
            const container = (app as any).container;
            const modulesContainer = container.getModules();

            // Entity Explorer
            const entityExplorer = app.get(EntityExplorerService);
            entityExplorer.initialize(modulesContainer);

            // Route Explorer
            const routeExplorer = app.get(RouteExplorerService);
            const globalPrefix = (app as any).config?.getGlobalPrefix ? (app as any).config.getGlobalPrefix() : '';
            routeExplorer.initialize(modulesContainer, globalPrefix);

        } catch (e) {
            console.warn('Profiler: Could not initialize Explorers. Ensure ProfilerModule is imported.', e);
        }
    }
}

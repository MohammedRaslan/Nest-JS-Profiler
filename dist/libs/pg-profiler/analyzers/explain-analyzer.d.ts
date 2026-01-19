import * as pg from 'pg';
export declare class ExplainAnalyzer {
    private readonly logger;
    analyze(client: pg.Client | pg.PoolClient, query: string, params: any[], useAnalyze?: boolean): Promise<any>;
}

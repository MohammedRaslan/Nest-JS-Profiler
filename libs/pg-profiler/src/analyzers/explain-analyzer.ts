import { Injectable, Logger } from '@nestjs/common';
import * as pg from 'pg';

@Injectable()
export class ExplainAnalyzer {
    private readonly logger = new Logger(ExplainAnalyzer.name);

    async analyze(
        client: pg.Client | pg.PoolClient,
        query: string,
        params: any[],
        useAnalyze: boolean = false
    ): Promise<any> {
        try {
            const cmd = useAnalyze ? 'EXPLAIN (ANALYZE, FORMAT JSON)' : 'EXPLAIN (FORMAT JSON)';
            const explainSql = `${cmd} ${query}`;

            const result = await client.query(explainSql, params);
            if (result.rows && result.rows.length > 0) {
                return result.rows[0]['QUERY PLAN'];
            }
            return null;
        } catch (e: any) {
            if (e.message.includes('closed') || e.message.includes('terminated')) {
                // Ignore closed client errors
                return null;
            }
            if (process.env.PROFILER_DEBUG) {
                this.logger.warn(`Failed to run EXPLAIN: ${e.message}`);
            }
            return null;
        }
    }
}

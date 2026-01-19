"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ExplainAnalyzer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplainAnalyzer = void 0;
const common_1 = require("@nestjs/common");
let ExplainAnalyzer = ExplainAnalyzer_1 = class ExplainAnalyzer {
    logger = new common_1.Logger(ExplainAnalyzer_1.name);
    async analyze(client, query, params, useAnalyze = false) {
        try {
            const cmd = useAnalyze ? 'EXPLAIN (ANALYZE, FORMAT JSON)' : 'EXPLAIN (FORMAT JSON)';
            const explainSql = `${cmd} ${query}`;
            const result = await client.query(explainSql, params);
            if (result.rows && result.rows.length > 0) {
                return result.rows[0]['QUERY PLAN'];
            }
            return null;
        }
        catch (e) {
            if (e.message.includes('closed') || e.message.includes('terminated')) {
                return null;
            }
            if (process.env.PROFILER_DEBUG) {
                this.logger.warn(`Failed to run EXPLAIN: ${e.message}`);
            }
            return null;
        }
    }
};
exports.ExplainAnalyzer = ExplainAnalyzer;
exports.ExplainAnalyzer = ExplainAnalyzer = ExplainAnalyzer_1 = __decorate([
    (0, common_1.Injectable)()
], ExplainAnalyzer);
//# sourceMappingURL=explain-analyzer.js.map
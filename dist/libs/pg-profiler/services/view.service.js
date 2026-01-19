"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let ViewService = class ViewService {
    viewsPath;
    constructor() {
        this.viewsPath = path.join(__dirname, '..', 'views');
    }
    exists(viewName) {
        const viewPath = path.join(this.viewsPath, `${viewName}.html`);
        return fs.existsSync(viewPath);
    }
    render(viewName, data = {}) {
        const viewPath = path.join(this.viewsPath, `${viewName}.html`);
        let template = this.loadTemplate(viewPath);
        template = this.interpolate(template, data);
        return template;
    }
    renderWithLayout(title, content, activeTab = 'requests') {
        const layoutPath = path.join(this.viewsPath, 'layout.html');
        let layout = this.loadTemplate(layoutPath);
        const data = {
            title,
            content,
            activeTab,
            activeClass: 'bg-indigo-600 text-white',
            inactiveClass: 'text-slate-300 hover:bg-slate-800 hover:text-white',
            requestsActive: activeTab === 'requests' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            queriesActive: activeTab === 'queries' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            logsActive: activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            entitiesActive: activeTab === 'entities' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            requestsIconClass: activeTab === 'requests' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
            queriesIconClass: activeTab === 'queries' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
            logsIconClass: activeTab === 'logs' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
            entitiesIconClass: activeTab === 'entities' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-white',
        };
        layout = this.interpolate(layout, data);
        return layout;
    }
    loadTemplate(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to load template: ${filePath}`);
        }
    }
    interpolate(template, data) {
        template = template.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (match, key) => {
            return data[key] ?? '';
        });
        template = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
            return this.escapeHtml(data[key] ?? '');
        });
        return template;
    }
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }
    timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1)
            return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1)
            return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1)
            return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1)
            return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1)
            return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
    }
    getStatusClass(statusCode) {
        if (statusCode >= 500)
            return 'bg-red-100 text-red-700';
        if (statusCode >= 400)
            return 'bg-yellow-100 text-yellow-700';
        if (statusCode >= 300)
            return 'bg-blue-100 text-blue-700';
        return 'bg-green-100 text-green-700';
    }
    getMethodBadge(method) {
        const badges = {
            'GET': 'bg-blue-100 text-blue-800',
            'POST': 'bg-green-100 text-green-800',
            'PUT': 'bg-orange-100 text-orange-800',
            'PATCH': 'bg-yellow-100 text-yellow-800',
            'DELETE': 'bg-red-100 text-red-800',
        };
        const classes = badges[method] || 'bg-gray-100 text-gray-800';
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${classes}">${method}</span>`;
    }
    getDatabaseBadge(database) {
        if (database === 'mongodb') {
            return '<span class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">MongoDB</span>';
        }
        if (database === 'mysql') {
            return '<span class="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">MySQL</span>';
        }
        return '<span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">PostgreSQL</span>';
    }
    getLogLevelColor(level) {
        if (level === 'error')
            return 'text-red-700 bg-red-50 ring-red-600/20';
        if (level === 'warn')
            return 'text-yellow-800 bg-yellow-50 ring-yellow-600/20';
        return 'text-gray-600 bg-gray-50 ring-gray-500/10';
    }
};
exports.ViewService = ViewService;
exports.ViewService = ViewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ViewService);
//# sourceMappingURL=view.service.js.map
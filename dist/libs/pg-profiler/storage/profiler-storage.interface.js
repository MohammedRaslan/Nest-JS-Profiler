"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryProfilerStorage = void 0;
class InMemoryProfilerStorage {
    profiles = [];
    limit = 100;
    async save(profile) {
        const existingIndex = this.profiles.findIndex(p => p.id === profile.id);
        if (existingIndex !== -1) {
            this.profiles[existingIndex] = profile;
        }
        else {
            this.profiles.unshift(profile);
            if (this.profiles.length > this.limit) {
                this.profiles.pop();
            }
        }
    }
    async get(id) {
        return this.profiles.find((p) => p.id === id) || null;
    }
    async all() {
        return this.profiles;
    }
}
exports.InMemoryProfilerStorage = InMemoryProfilerStorage;
//# sourceMappingURL=profiler-storage.interface.js.map
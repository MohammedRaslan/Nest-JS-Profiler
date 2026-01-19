import { RequestProfile } from '../common/profiler.model';

export interface ProfilerStorage {
    save(profile: RequestProfile): Promise<void> | void;
    get(id: string): Promise<RequestProfile | null> | RequestProfile | null;
    all(): Promise<RequestProfile[]> | RequestProfile[];
}

export class InMemoryProfilerStorage implements ProfilerStorage {
    private profiles: RequestProfile[] = [];
    private limit = 100;

    async save(profile: RequestProfile): Promise<void> {
        const existingIndex = this.profiles.findIndex(p => p.id === profile.id);
        if (existingIndex !== -1) {
            this.profiles[existingIndex] = profile;
        } else {
            this.profiles.unshift(profile);
            if (this.profiles.length > this.limit) {
                this.profiles.pop();
            }
        }
    }

    async get(id: string): Promise<RequestProfile | null> {
        return this.profiles.find((p) => p.id === id) || null;
    }

    async all(): Promise<RequestProfile[]> {
        return this.profiles;
    }
}

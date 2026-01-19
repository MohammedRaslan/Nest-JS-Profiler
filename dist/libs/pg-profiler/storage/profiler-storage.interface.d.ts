import { RequestProfile } from '../common/profiler.model';
export interface ProfilerStorage {
    save(profile: RequestProfile): Promise<void> | void;
    get(id: string): Promise<RequestProfile | null> | RequestProfile | null;
    all(): Promise<RequestProfile[]> | RequestProfile[];
}
export declare class InMemoryProfilerStorage implements ProfilerStorage {
    private profiles;
    private limit;
    save(profile: RequestProfile): Promise<void>;
    get(id: string): Promise<RequestProfile | null>;
    all(): Promise<RequestProfile[]>;
}

import { RequestProfile } from '../common/profiler.model';

export interface ProfilerStorage {
    save(profile: RequestProfile): Promise<void> | void;
    get(id: string): Promise<RequestProfile | null> | RequestProfile | null;
    all(): Promise<RequestProfile[]> | RequestProfile[];
}



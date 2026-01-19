import { NestMiddleware } from '@nestjs/common';
export declare class ProfilerMiddleware implements NestMiddleware {
    use(req: any, res: any, next: () => void): void;
}

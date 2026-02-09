import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class ProfilerMiddleware implements NestMiddleware {
    use(req: any, res: any, next: () => void) {
        req._profilerT0 = Date.now();
        next();
    }
}

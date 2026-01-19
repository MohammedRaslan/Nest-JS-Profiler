import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class ProfilerMiddleware implements NestMiddleware {
    use(req: any, res: any, next: () => void) {
        // Capture T0: The moment request hits the middleware chain
        // We attach it to the request object to read it later in the interceptor
        req._profilerT0 = Date.now();
        next();
    }
}

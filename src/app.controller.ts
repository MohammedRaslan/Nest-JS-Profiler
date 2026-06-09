import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as http from 'http';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  /** Basic hello — generates a clean request in the profiler */
  @Get()
  getHello(): string {
    this.logger.log('Hello endpoint called');
    return this.appService.getHello();
  }

  /** Simulates a slow endpoint (300ms delay) */
  @Get('demo/slow')
  async slow(): Promise<{ message: string; duration: string }> {
    this.logger.warn('Slow endpoint triggered');
    await new Promise((r) => setTimeout(r, 300));
    return { message: 'This was a slow request', duration: '~300ms' };
  }

  /** Simulates multiple requests to show N+1 pattern in profiler */
  @Get('demo/multi')
  async multi(): Promise<{ items: number[] }> {
    this.logger.log('Multi endpoint called');
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 30));
    await new Promise((r) => setTimeout(r, 20));
    return { items: [1, 2, 3] };
  }

  /** Simulates a 500 error — shows up in error rate on the summary dashboard */
  @Get('demo/error')
  throwError(): never {
    this.logger.error('Demo error triggered');
    throw new HttpException('Something went wrong (demo)', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /** Simulates a 404 */
  @Get('demo/not-found')
  notFound(): never {
    this.logger.error('Demo not found triggered');
    throw new HttpException('Resource not found (demo)', HttpStatus.NOT_FOUND);
  }

  /** Makes outbound HTTP calls to local endpoints — shows up in profiler HTTP Calls tab */
  @Get('demo/http')
  async demoHttp(): Promise<{ results: any[] }> {
    this.logger.log('Demo HTTP endpoint called');

    const fetchLocal = (path: string) =>
      new Promise<any>((resolve, reject) => {
        http.get({ host: 'localhost', port: 3000, path }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve(body); }
          });
        }).on('error', reject);
      });

    // Fan out three calls in parallel — demonstrates concurrent outbound tracking
    const [hello, slow, multi] = await Promise.all([
      fetchLocal('/'),
      fetchLocal('/demo/slow'),
      fetchLocal('/demo/multi'),
    ]);

    return { results: [hello, slow, multi] };
  }
}

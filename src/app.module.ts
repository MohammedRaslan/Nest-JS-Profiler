import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilerModule } from '../libs/nestjs-profiler/src';

@Module({
  imports: [
    ProfilerModule.forRoot({
      enabled: true,
      collectQueries: true,
      collectLogs: true,
      collectCache: true,
      collectHttp: true,
      pgDriver: require('pg'),
    }),
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilerModule } from '../libs/nestjs-profiler/src';
import { DemoModule } from './demo/demo.module';

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
    CacheModule.register({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

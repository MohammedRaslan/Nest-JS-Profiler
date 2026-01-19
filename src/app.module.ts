import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilerModule } from '@nestjs-pg-profiler/core';

@Module({
  imports: [
    ProfilerModule.forRoot({
      enabled: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

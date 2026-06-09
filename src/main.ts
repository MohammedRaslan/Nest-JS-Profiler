import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ProfilerModule } from '../libs/nestjs-profiler/src';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve profiler static assets when running from source (dev workspace)
  app.useStaticAssets(
    join(__dirname, '..', 'libs/nestjs-profiler/src/assets'),
    { prefix: '/assets/' },
  );

  // Initialize entity & route explorers after app is fully wired
  ProfilerModule.initialize(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

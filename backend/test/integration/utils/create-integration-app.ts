import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from '@src/app.module';
import { AllExceptionsFilter } from '@src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '@src/common/interceptors/logging.interceptor';

export async function createIntegrationApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({
    rawBody: true,
  });

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return app;
}

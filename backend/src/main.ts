import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '@src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '@src/common/interceptors/logging.interceptor';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // enabled so the backend can verify Stripe webhook signatures using the exact raw request bytes
    rawBody: true,
  });

  const logger = new Logger('App');

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

  const config = new DocumentBuilder()
    .setTitle('Ledger Light API')
    .setDescription('Backend API for Ledger Light')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste your access token here',
      },
      'bearer',
    )
    .build();

  /**
   * Swagger docs available at http://localhost:8080/docs
   */
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.BACKEND_PORT || 8081;
  await app.listen(port);
  logger.log(`Listening on port ${port}...`);
}

bootstrap();

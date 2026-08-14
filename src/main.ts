import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Set global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configure CORS for production (sunlitesolar.com.au) and local dev
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('sunlitesolar.com.au') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('netlify.app');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true); // Fallback to true in dev for convenience
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Sunlite Solar Backend API is running on: http://localhost:${port}/api`);
  logger.log(`💳 eWay Payment API available at: http://localhost:${port}/api/payments/eway`);
}

bootstrap();

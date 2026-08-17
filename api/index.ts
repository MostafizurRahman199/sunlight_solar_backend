import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const expressApp = express();
let cachedApp: any;

async function bootstrapServerless() {
  if (!cachedApp) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    app.setGlobalPrefix('api');

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

    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    await app.init();
    cachedApp = expressApp;
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const server = await bootstrapServerless();
    return server(req, res);
  } catch (error: any) {
    console.error('Vercel Serverless NestJS Boot Error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Serverless NestJS Boot Failure',
      error: error?.message || String(error),
    });
  }
}

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import {
  installOutboundGuard,
  notificationsDeliver,
  outboundPolicy,
} from './common/utils/outbound-guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Dış dünyaya çıkış kapısı: her modülden ÖNCE kurulur (staging'de varsayılan kapalı).
  // APP_ENV .env'den gelir; ConfigModule'ün yüklemesini beklemeden burada okunur
  // (dotenv var olan değişkeni ezmez, ConfigModule ile aynı dosya ve aynı kural).
  dotenv.config({ path: '.env' });
  const outbound = outboundPolicy();
  installOutboundGuard(outbound);
  logger.log(
    `APP_ENV=${outbound.env} · dış HTTP: ${outbound.blocked ? `KAPALI (izinli: ${outbound.allowlist.join(', ') || 'yok'})` : 'açık'}` +
      ` · bildirim: ${notificationsDeliver() ? 'gerçek gönderim' : 'console'}`,
  );

  const app = await NestFactory.create(AppModule);

  const express = require('express');
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('KroptOS API')
    .setDescription('Multi-tenant Commerce Operating System API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  logger.log(`✅ Backend running on http://localhost:${port}`);
  logger.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

function requireSecret(name: string) {
  const v = process.env[name];
  if (!v || v.length < 32 || v.startsWith('change-me')) {
    if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be set to a strong secret (32+ chars) in production`);
    Logger.warn(`${name} is weak or default — OK for development only`, 'Security');
  }
}

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    credentials: false,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Device-Id'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useBodyParser('json', { limit: '1mb' });
  return app;
}

async function bootstrap() {
  requireSecret('JWT_ACCESS_SECRET');
  requireSecret('JWT_REFRESH_SECRET');
  const app = await createApp();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`HRMS API running on http://localhost:${port}/api/v1`, 'Bootstrap');
}

if (require.main === module) bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { bootstrapDatabase } from './database/bootstrap';

async function bootstrap() {
  await bootstrapDatabase();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  const port = Number(process.env.API_PORT || 3100);
  await app.listen(port);
  console.log(`JH Hogar API → http://localhost:${port}/api`);
}
bootstrap();

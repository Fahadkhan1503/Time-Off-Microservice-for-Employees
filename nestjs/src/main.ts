import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors();

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Time-Off Microservice API')
    .setDescription('API for managing employee time-off requests and leave balances')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log('Time-Off Microservice running on http://localhost:3000');
  console.log('Swagger docs available at http://localhost:3000/api/docs');
}

bootstrap();
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { EnvironmentVariables } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('URL Shortener')
      .setDescription('Short links with optional expiration, click statistics and fast redirects')
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  Logger.log(`URL Shortener is listening on port ${port}`, 'Bootstrap');
}

await bootstrap();

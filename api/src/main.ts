import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import type { Ambiente } from './config/ambiente.js';
import { configurarApp } from './configurar-app.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
configurarApp(app);

const config = app.get<ConfigService<Ambiente, true>>(ConfigService);

// Atrás do Caddy: usa o IP do cliente (X-Forwarded-For) no rate limit.
if (config.get('CONFIAR_PROXY', { infer: true })) {
  app.set('trust proxy', 1);
}

// Documentação OpenAPI (/docs e /docs-json) fora de produção. O app gera seus tipos a partir dela.
if (config.get('NODE_ENV', { infer: true }) !== 'production') {
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Rede Casinha API').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, documento);
}

await app.listen(config.get('PORT', { infer: true }));

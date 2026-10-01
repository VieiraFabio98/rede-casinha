import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import type { Ambiente } from './config/ambiente.js';
import { AppErrorFilter } from './shared/filters/app-error.filter.js';
import { HttpResponseInterceptor } from './shared/interceptors/http-response.interceptor.js';

/**
 * Configuração comum à aplicação real (main.ts) e aos testes e2e,
 * para que os testes exercitem exatamente o mesmo pipeline.
 */
export function configurarApp(app: INestApplication): void {
  const config = app.get<ConfigService<Ambiente, true>>(ConfigService);

  // Cabeçalhos de segurança. Fora de produção o CSP fica desligado para a página /docs (Swagger UI).
  app.use(
    helmet({
      contentSecurityPolicy:
        config.get('NODE_ENV', { infer: true }) === 'production' ? undefined : false,
    }),
  );
  // CORS fechado: só os sites da lista (o app Android não passa por CORS).
  const origens = config.get('CORS_ORIGENS', { infer: true });
  if (origens.length > 0) {
    app.enableCors({ origin: origens, methods: ['GET', 'POST', 'DELETE'], maxAge: 600 });
  }

  // Rotas de negócio ficam em /v1; /saude fica na raiz para o monitoramento.
  app.setGlobalPrefix('v1', { exclude: ['saude'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // Erros de aplicação (shared/errors) → HTTP; controllers devolvem ok(...) / noContent().
  app.useGlobalFilters(new AppErrorFilter());
  app.useGlobalInterceptors(new HttpResponseInterceptor());
  app.enableShutdownHooks();
}

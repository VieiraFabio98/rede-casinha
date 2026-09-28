import { INestApplication, ValidationPipe } from '@nestjs/common';

import { AppErrorFilter } from './shared/filters/app-error.filter.js';
import { HttpResponseInterceptor } from './shared/interceptors/http-response.interceptor.js';

/**
 * Configuração comum à aplicação real (main.ts) e aos testes e2e,
 * para que os testes exercitem exatamente o mesmo pipeline.
 */
export function configurarApp(app: INestApplication): void {
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

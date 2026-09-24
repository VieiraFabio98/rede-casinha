import { INestApplication, ValidationPipe } from '@nestjs/common';

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
  app.enableShutdownHooks();
}

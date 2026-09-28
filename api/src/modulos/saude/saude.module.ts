import { Module } from '@nestjs/common';

import { VerificarSaudeUseCase } from './application/use-cases/verificar-saude.use-case.js';
import { BANCO_DE_DADOS } from './domain/providers/banco-de-dados.provider.js';
import { SaudeController } from './infra/controllers/saude.controller.js';
import { PrismaBancoDeDados } from './infra/providers/prisma-banco-de-dados.js';

@Module({
  controllers: [SaudeController],
  providers: [VerificarSaudeUseCase, { provide: BANCO_DE_DADOS, useClass: PrismaBancoDeDados }],
})
export class SaudeModule {}

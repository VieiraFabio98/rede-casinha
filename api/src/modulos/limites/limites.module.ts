import { Module } from '@nestjs/common';

import { ConsumirLimiteUseCase } from './application/use-cases/consumir-limite.use-case.js';
import { LIMITES_USO_REPOSITORY } from './domain/repositories/limites-uso.repository.js';
import { PrismaLimitesUsoRepository } from './infra/repositories/prisma-limites-uso.repository.js';

/** Limites diários (RN06). Sem rotas: os outros módulos usam o `ConsumirLimiteUseCase`. */
@Module({
  providers: [
    ConsumirLimiteUseCase,
    { provide: LIMITES_USO_REPOSITORY, useClass: PrismaLimitesUsoRepository },
  ],
  exports: [ConsumirLimiteUseCase],
})
export class LimitesModule {}

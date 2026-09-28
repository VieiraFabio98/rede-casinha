import { Module } from '@nestjs/common';

import { ExpirarNecessidadesUseCase } from './application/use-cases/expirar-necessidades.use-case.js';
import { RecalcularStatusDeTodasUseCase } from './application/use-cases/recalcular-status-de-todas.use-case.js';
import { RecalcularStatusUseCase } from './application/use-cases/recalcular-status.use-case.js';
import { STATUS_REPOSITORY } from './domain/repositories/status.repository.js';
import { TarefasStatusJob } from './infra/jobs/tarefas-status.job.js';
import { PrismaStatusRepository } from './infra/repositories/prisma-status.repository.js';

/** Status das casinhas (RN01) e expiração (RN02): na hora de cada ação e com o tempo (jobs). */
@Module({
  providers: [
    RecalcularStatusUseCase,
    ExpirarNecessidadesUseCase,
    RecalcularStatusDeTodasUseCase,
    TarefasStatusJob,
    { provide: STATUS_REPOSITORY, useClass: PrismaStatusRepository },
  ],
  exports: [RecalcularStatusUseCase, ExpirarNecessidadesUseCase, RecalcularStatusDeTodasUseCase],
})
export class StatusModule {}

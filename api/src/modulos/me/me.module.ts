import { Module } from '@nestjs/common';

import { ConcluirCadastroUseCase } from './application/use-cases/concluir-cadastro.use-case.js';
import { ContarContribuicoesUseCase } from './application/use-cases/contar-contribuicoes.use-case.js';
import { ExcluirContaUseCase } from './application/use-cases/excluir-conta.use-case.js';
import { ObterContaUseCase } from './application/use-cases/obter-conta.use-case.js';
import { FotosModule } from '../fotos/fotos.module.js';
import { ARQUIVOS_DE_FOTOS } from './domain/providers/arquivos-de-fotos.provider.js';
import { CONTAS_REPOSITORY } from './domain/repositories/contas.repository.js';
import { MeController } from './infra/controllers/me.controller.js';
import { ArquivosDeFotosAdapter } from './infra/providers/arquivos-de-fotos.adapter.js';
import { PrismaContasRepository } from './infra/repositories/prisma-contas.repository.js';

/** A conta logada: dados, cadastro, contagens e exclusão (RN07). */
@Module({
  imports: [FotosModule],
  controllers: [MeController],
  providers: [
    ObterContaUseCase,
    ContarContribuicoesUseCase,
    ConcluirCadastroUseCase,
    ExcluirContaUseCase,
    { provide: CONTAS_REPOSITORY, useClass: PrismaContasRepository },
    { provide: ARQUIVOS_DE_FOTOS, useClass: ArquivosDeFotosAdapter },
  ],
})
export class MeModule {}

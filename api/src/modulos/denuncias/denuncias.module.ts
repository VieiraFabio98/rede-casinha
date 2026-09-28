import { Module } from '@nestjs/common';

import { CasinhasModule } from '../casinhas/casinhas.module.js';
import { LimitesModule } from '../limites/limites.module.js';
import { ModeracaoModule } from '../moderacao/moderacao.module.js';
import { DenunciarUseCase } from './application/use-cases/denunciar.use-case.js';
import { PedirDesativacaoUseCase } from './application/use-cases/pedir-desativacao.use-case.js';
import {
  ACESSO_CASINHA,
  CONTROLE_DE_LIMITES,
  OCULTACAO_AUTOMATICA,
} from './domain/providers/portas.js';
import { DENUNCIAS_REPOSITORY } from './domain/repositories/denuncias.repository.js';
import { DenunciasController } from './infra/controllers/denuncias.controller.js';
import {
  AcessoCasinhaAdapter,
  LimitesAdapter,
  OcultacaoAdapter,
} from './infra/providers/adaptadores.js';
import { PrismaDenunciasRepository } from './infra/repositories/prisma-denuncias.repository.js';

/** Denunciar (RF06.1, com ocultação automática RF06.2) e "a casinha não existe mais" (RF02.7). */
@Module({
  imports: [CasinhasModule, LimitesModule, ModeracaoModule],
  controllers: [DenunciasController],
  providers: [
    DenunciarUseCase,
    PedirDesativacaoUseCase,
    { provide: DENUNCIAS_REPOSITORY, useClass: PrismaDenunciasRepository },
    { provide: ACESSO_CASINHA, useClass: AcessoCasinhaAdapter },
    { provide: CONTROLE_DE_LIMITES, useClass: LimitesAdapter },
    { provide: OCULTACAO_AUTOMATICA, useClass: OcultacaoAdapter },
  ],
})
export class DenunciasModule {}

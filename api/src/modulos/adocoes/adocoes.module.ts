import { Module } from '@nestjs/common';

import { CasinhasModule } from '../casinhas/casinhas.module.js';
import { LimitesModule } from '../limites/limites.module.js';
import { LocalizacaoModule } from '../localizacao/localizacao.module.js';
import { AdotarCasinhaUseCase } from './application/use-cases/adotar-casinha.use-case.js';
import { DeixarDeAdotarUseCase } from './application/use-cases/deixar-de-adotar.use-case.js';
import {
  ACESSO_CASINHA,
  CONTROLE_DE_LIMITES,
  VERIFICADOR_DE_PROXIMIDADE,
} from './domain/providers/portas.js';
import { ADOCOES_REPOSITORY } from './domain/repositories/adocoes.repository.js';
import { AdocoesController } from './infra/controllers/adocoes.controller.js';
import {
  AcessoCasinhaAdapter,
  LimitesAdapter,
  ProximidadeAdapter,
} from './infra/providers/adaptadores.js';
import { PrismaAdocoesRepository } from './infra/repositories/prisma-adocoes.repository.js';

/** Adotar e deixar de adotar (RF04). */
@Module({
  imports: [CasinhasModule, LocalizacaoModule, LimitesModule],
  controllers: [AdocoesController],
  providers: [
    AdotarCasinhaUseCase,
    DeixarDeAdotarUseCase,
    { provide: ADOCOES_REPOSITORY, useClass: PrismaAdocoesRepository },
    { provide: ACESSO_CASINHA, useClass: AcessoCasinhaAdapter },
    { provide: VERIFICADOR_DE_PROXIMIDADE, useClass: ProximidadeAdapter },
    { provide: CONTROLE_DE_LIMITES, useClass: LimitesAdapter },
  ],
})
export class AdocoesModule {}

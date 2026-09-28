import { Module } from '@nestjs/common';

import { LimitesModule } from '../limites/limites.module.js';
import { LocalizacaoModule } from '../localizacao/localizacao.module.js';
import { CadastrarCasinhaUseCase } from './application/use-cases/cadastrar-casinha.use-case.js';
import { DetalharCasinhaUseCase } from './application/use-cases/detalhar-casinha.use-case.js';
import { ListarCasinhasNaAreaUseCase } from './application/use-cases/listar-casinhas-na-area.use-case.js';
import { ListarMinhasCasinhasUseCase } from './application/use-cases/listar-minhas-casinhas.use-case.js';
import { TravarCasinhaParaAcaoUseCase } from './application/use-cases/travar-casinha-para-acao.use-case.js';
import { CONTROLE_DE_LIMITES } from './domain/providers/limites.provider.js';
import { LOCALIZACAO_EXATA } from './domain/providers/localizacao-exata.provider.js';
import { URLS_DE_FOTOS } from './domain/providers/urls-de-fotos.provider.js';
import { CASINHAS_REPOSITORY } from './domain/repositories/casinhas.repository.js';
import {
  CasinhasController,
  MinhasCasinhasController,
} from './infra/controllers/casinhas.controller.js';
import { LimitesAdapter } from './infra/providers/limites.adapter.js';
import { LocalizacaoExataAdapter } from './infra/providers/localizacao-exata.adapter.js';
import { UrlsDeFotosAdapter } from './infra/providers/urls-de-fotos.adapter.js';
import { PrismaCasinhasRepository } from './infra/repositories/prisma-casinhas.repository.js';

/** Cadastro, mapa, detalhe e "minhas casinhas". Exporta a trava usada por toda escrita numa casinha. */
@Module({
  imports: [LocalizacaoModule, LimitesModule],
  controllers: [CasinhasController, MinhasCasinhasController],
  providers: [
    ListarCasinhasNaAreaUseCase,
    ListarMinhasCasinhasUseCase,
    DetalharCasinhaUseCase,
    CadastrarCasinhaUseCase,
    TravarCasinhaParaAcaoUseCase,
    { provide: CASINHAS_REPOSITORY, useClass: PrismaCasinhasRepository },
    { provide: LOCALIZACAO_EXATA, useClass: LocalizacaoExataAdapter },
    { provide: URLS_DE_FOTOS, useClass: UrlsDeFotosAdapter },
    { provide: CONTROLE_DE_LIMITES, useClass: LimitesAdapter },
  ],
  exports: [TravarCasinhaParaAcaoUseCase],
})
export class CasinhasModule {}

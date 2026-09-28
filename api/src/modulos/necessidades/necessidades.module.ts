import { Module } from '@nestjs/common';

import { CasinhasModule } from '../casinhas/casinhas.module.js';
import { LimitesModule } from '../limites/limites.module.js';
import { LocalizacaoModule } from '../localizacao/localizacao.module.js';
import { StatusModule } from '../status/status.module.js';
import { AcaoNaNecessidade } from './application/use-cases/acao-na-necessidade.js';
import { AtenderNecessidadeUseCase } from './application/use-cases/atender-necessidade.use-case.js';
import { ContestarAtendimentoUseCase } from './application/use-cases/contestar-atendimento.use-case.js';
import { ExecucaoDeAcao } from './application/use-cases/execucao-de-acao.js';
import { FazerCheckInUseCase } from './application/use-cases/fazer-check-in.use-case.js';
import { ReconfirmarNecessidadeUseCase } from './application/use-cases/reconfirmar-necessidade.use-case.js';
import { ReportarNecessidadeUseCase } from './application/use-cases/reportar-necessidade.use-case.js';
import { ACESSO_CASINHA } from './domain/providers/acesso-casinha.provider.js';
import { CONTROLE_DE_LIMITES } from './domain/providers/limites.provider.js';
import { VERIFICADOR_DE_PROXIMIDADE } from './domain/providers/proximidade.provider.js';
import { RECALCULADOR_DE_STATUS } from './domain/providers/status.provider.js';
import { ATIVIDADES_REPOSITORY } from './domain/repositories/atividades.repository.js';
import { CASINHAS_REPOSITORY } from './domain/repositories/casinhas.repository.js';
import { NECESSIDADES_REPOSITORY } from './domain/repositories/necessidades.repository.js';
import { NecessidadesController } from './infra/controllers/necessidades.controller.js';
import {
  AcessoCasinhaAdapter,
  LimitesPeloModuloLimites,
  ProximidadePelaLocalizacao,
  StatusPeloModuloStatus,
} from './infra/providers/adaptadores.js';
import { PrismaAtividadesRepository } from './infra/repositories/prisma-atividades.repository.js';
import { PrismaCasinhasRepository } from './infra/repositories/prisma-casinhas.repository.js';
import { PrismaNecessidadesRepository } from './infra/repositories/prisma-necessidades.repository.js';

/**
 * Reportar, reconfirmar, atender, contestar e check-in (RF03, RN02, RN03).
 * - domain: entidades, portas (repositórios e providers) e regras puras;
 * - application: DTOs e use-cases, que só conhecem as portas;
 * - infra: controller e implementações (Prisma e adaptadores para outros módulos).
 */
@Module({
  imports: [CasinhasModule, LocalizacaoModule, StatusModule, LimitesModule],
  controllers: [NecessidadesController],
  providers: [
    // application
    ExecucaoDeAcao,
    AcaoNaNecessidade,
    ReportarNecessidadeUseCase,
    ReconfirmarNecessidadeUseCase,
    AtenderNecessidadeUseCase,
    ContestarAtendimentoUseCase,
    FazerCheckInUseCase,
    // infra → portas do domain
    { provide: NECESSIDADES_REPOSITORY, useClass: PrismaNecessidadesRepository },
    { provide: ATIVIDADES_REPOSITORY, useClass: PrismaAtividadesRepository },
    { provide: CASINHAS_REPOSITORY, useClass: PrismaCasinhasRepository },
    { provide: ACESSO_CASINHA, useClass: AcessoCasinhaAdapter },
    { provide: VERIFICADOR_DE_PROXIMIDADE, useClass: ProximidadePelaLocalizacao },
    { provide: RECALCULADOR_DE_STATUS, useClass: StatusPeloModuloStatus },
    { provide: CONTROLE_DE_LIMITES, useClass: LimitesPeloModuloLimites },
  ],
})
export class NecessidadesModule {}

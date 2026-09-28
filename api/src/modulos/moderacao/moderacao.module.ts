import { Module } from '@nestjs/common';

import { LocalizacaoModule } from '../localizacao/localizacao.module.js';
import { StatusModule } from '../status/status.module.js';
import { AlterarNivelUseCase } from './application/use-cases/alterar-nivel.use-case.js';
import { BloquearUsuarioUseCase } from './application/use-cases/bloquear-usuario.use-case.js';
import { MesclarCasinhasUseCase } from './application/use-cases/mesclar-casinhas.use-case.js';
import {
  AtivarCasinhaUseCase,
  DesativarCasinhaUseCase,
} from './application/use-cases/mudar-situacao-casinha.use-case.js';
import { OcultarAutomaticamenteUseCase } from './application/use-cases/ocultar-automaticamente.use-case.js';
import { OcultarConteudoUseCase } from './application/use-cases/ocultar-conteudo.use-case.js';
import { ResolverDenunciaUseCase } from './application/use-cases/resolver-denuncia.use-case.js';
import { RestaurarConteudoUseCase } from './application/use-cases/restaurar-conteudo.use-case.js';
import { VerFilaUseCase } from './application/use-cases/ver-fila.use-case.js';
import { BUSCA_DE_DUPLICATAS, RECALCULADOR_DE_STATUS } from './domain/providers/portas.js';
import { AUDITORIA_REPOSITORY } from './domain/repositories/auditoria.repository.js';
import { CASINHAS_MODERACAO_REPOSITORY } from './domain/repositories/casinhas-moderacao.repository.js';
import { CONTEUDO_REPOSITORY } from './domain/repositories/conteudo.repository.js';
import { DENUNCIAS_MODERACAO_REPOSITORY } from './domain/repositories/denuncias.repository.js';
import { USUARIOS_MODERACAO_REPOSITORY } from './domain/repositories/usuarios-moderacao.repository.js';
import { ModeracaoController } from './infra/controllers/moderacao.controller.js';
import { DuplicatasAdapter, StatusAdapter } from './infra/providers/adaptadores.js';
import { PrismaAuditoriaRepository } from './infra/repositories/prisma-auditoria.repository.js';
import { PrismaCasinhasModeracaoRepository } from './infra/repositories/prisma-casinhas-moderacao.repository.js';
import { PrismaConteudoRepository } from './infra/repositories/prisma-conteudo.repository.js';
import { PrismaDenunciasModeracaoRepository } from './infra/repositories/prisma-denuncias-moderacao.repository.js';
import { PrismaUsuariosModeracaoRepository } from './infra/repositories/prisma-usuarios-moderacao.repository.js';

/** Rotas `/admin` (RF06.3). Exporta a ocultação automática para o módulo `denuncias`. */
@Module({
  imports: [LocalizacaoModule, StatusModule],
  controllers: [ModeracaoController],
  providers: [
    VerFilaUseCase,
    OcultarConteudoUseCase,
    RestaurarConteudoUseCase,
    OcultarAutomaticamenteUseCase,
    ResolverDenunciaUseCase,
    DesativarCasinhaUseCase,
    AtivarCasinhaUseCase,
    MesclarCasinhasUseCase,
    AlterarNivelUseCase,
    BloquearUsuarioUseCase,
    { provide: CONTEUDO_REPOSITORY, useClass: PrismaConteudoRepository },
    { provide: DENUNCIAS_MODERACAO_REPOSITORY, useClass: PrismaDenunciasModeracaoRepository },
    { provide: AUDITORIA_REPOSITORY, useClass: PrismaAuditoriaRepository },
    { provide: CASINHAS_MODERACAO_REPOSITORY, useClass: PrismaCasinhasModeracaoRepository },
    { provide: USUARIOS_MODERACAO_REPOSITORY, useClass: PrismaUsuariosModeracaoRepository },
    { provide: RECALCULADOR_DE_STATUS, useClass: StatusAdapter },
    { provide: BUSCA_DE_DUPLICATAS, useClass: DuplicatasAdapter },
  ],
  exports: [OcultarAutomaticamenteUseCase],
})
export class ModeracaoModule {}

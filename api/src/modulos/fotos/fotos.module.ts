import { Module } from '@nestjs/common';

import { Armazenamento } from '../../shared/infra/armazenamento/armazenamento.service.js';
import { AssinaturaDeUrls } from '../../shared/infra/armazenamento/assinatura-de-urls.js';
import { CasinhasModule } from '../casinhas/casinhas.module.js';
import { LimitesModule } from '../limites/limites.module.js';
import { AbrirFotoUseCase } from './application/use-cases/abrir-foto.use-case.js';
import { ApagarArquivosDeFotosUseCase } from './application/use-cases/apagar-arquivos-de-fotos.use-case.js';
import { EnviarFotoUseCase } from './application/use-cases/enviar-foto.use-case.js';
import { LimparFotosExpiradasUseCase } from './application/use-cases/limpar-fotos-expiradas.use-case.js';
import {
  ACESSO_CASINHA,
  ARQUIVOS_DE_FOTOS,
  ASSINADOR_DE_URLS,
  CONTROLE_DE_LIMITES,
} from './domain/providers/portas.js';
import { FOTOS_REPOSITORY } from './domain/repositories/fotos.repository.js';
import { FotosController } from './infra/controllers/fotos.controller.js';
import { LimparFotosJob } from './infra/jobs/limpar-fotos.job.js';
import { AcessoCasinhaAdapter, LimitesAdapter } from './infra/providers/adaptadores.js';
import { PrismaFotosRepository } from './infra/repositories/prisma-fotos.repository.js';

/**
 * Upload, URL assinada e entrega das fotos; limpeza das expiradas. Os arquivos ficam no
 * `Armazenamento` global (disco ou S3, por ARMAZENAMENTO_DRIVER).
 */
@Module({
  imports: [CasinhasModule, LimitesModule],
  controllers: [FotosController],
  providers: [
    EnviarFotoUseCase,
    AbrirFotoUseCase,
    LimparFotosExpiradasUseCase,
    ApagarArquivosDeFotosUseCase,
    LimparFotosJob,
    { provide: FOTOS_REPOSITORY, useClass: PrismaFotosRepository },
    { provide: ACESSO_CASINHA, useClass: AcessoCasinhaAdapter },
    { provide: CONTROLE_DE_LIMITES, useClass: LimitesAdapter },
    { provide: ARQUIVOS_DE_FOTOS, useExisting: Armazenamento },
    { provide: ASSINADOR_DE_URLS, useExisting: AssinaturaDeUrls },
  ],
  exports: [ApagarArquivosDeFotosUseCase],
})
export class FotosModule {}

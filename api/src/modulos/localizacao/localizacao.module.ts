import { Module } from '@nestjs/common';

import { CasinhasProximasUseCase } from './application/use-cases/casinhas-proximas.use-case.js';
import { ExataParaDetalheUseCase } from './application/use-cases/exata-para-detalhe.use-case.js';
import { ExatasParaListaUseCase } from './application/use-cases/exatas-para-lista.use-case.js';
import { ListarParesProximosUseCase } from './application/use-cases/listar-pares-proximos.use-case.js';
import { RegistrarExataUseCase } from './application/use-cases/registrar-exata.use-case.js';
import { VerificarProximidadeUseCase } from './application/use-cases/verificar-proximidade.use-case.js';
import { LOCALIZACAO_REPOSITORY } from './domain/repositories/localizacao.repository.js';
import { PrismaLocalizacaoRepository } from './infra/repositories/prisma-localizacao.repository.js';

/**
 * Único módulo que lê a localização exata (RN05). Sem rotas: os outros módulos usam os
 * use-cases exportados, que nunca devolvem distância entre o usuário e a casinha.
 */
@Module({
  providers: [
    ExatasParaListaUseCase,
    ExataParaDetalheUseCase,
    VerificarProximidadeUseCase,
    ListarParesProximosUseCase,
    CasinhasProximasUseCase,
    RegistrarExataUseCase,
    { provide: LOCALIZACAO_REPOSITORY, useClass: PrismaLocalizacaoRepository },
  ],
  exports: [
    ExatasParaListaUseCase,
    ExataParaDetalheUseCase,
    VerificarProximidadeUseCase,
    ListarParesProximosUseCase,
    CasinhasProximasUseCase,
    RegistrarExataUseCase,
  ],
})
export class LocalizacaoModule {}

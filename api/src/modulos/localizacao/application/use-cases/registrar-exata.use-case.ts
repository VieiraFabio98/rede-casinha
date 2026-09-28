import { Inject, Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import {
  LOCALIZACAO_REPOSITORY,
  type LocalizacaoRepository,
} from '../../domain/repositories/localizacao.repository.js';

/** Grava a localização exata de uma casinha recém-cadastrada (na transação do cadastro). */
@Injectable()
export class RegistrarExataUseCase {
  constructor(
    @Inject(LOCALIZACAO_REPOSITORY) private readonly repositorio: LocalizacaoRepository,
  ) {}

  executar(casinhaId: string, exata: Ponto, precisaoM: number): Promise<void> {
    return this.repositorio.criarExata(casinhaId, exata, precisaoM);
  }
}

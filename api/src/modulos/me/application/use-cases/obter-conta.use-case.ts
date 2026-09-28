import { Inject, Injectable } from '@nestjs/common';

import { NotFoundError } from '../../../../shared/errors/index.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import type { MeResposta } from '../dto/me.dto.js';

@Injectable()
export class ObterContaUseCase {
  constructor(@Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository) {}

  async executar(usuarioId: string): Promise<MeResposta> {
    const conta = await this.contas.buscar(usuarioId);
    if (!conta) throw new NotFoundError('Conta não encontrada');
    return conta;
  }
}

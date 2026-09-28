import { Inject, Injectable } from '@nestjs/common';

import { diaAtual } from '../../../../shared/domain/tempo.js';
import { ForbiddenError } from '../../../../shared/errors/index.js';
import { type AcaoLimitada, passouDoLimite } from '../../domain/limites.js';
import {
  LIMITES_USO_REPOSITORY,
  type LimitesUsoRepository,
} from '../../domain/repositories/limites-uso.repository.js';

/**
 * Conta 1 uso da ação no dia e recusa se passar do limite (RN06). Roda na transação da escrita:
 * se a escrita falhar, o uso não é contado.
 *
 * Responde 403 (não 429): é regra de negócio, e a fila do celular não deve insistir.
 */
@Injectable()
export class ConsumirLimiteUseCase {
  constructor(@Inject(LIMITES_USO_REPOSITORY) private readonly usos: LimitesUsoRepository) {}

  /** `limite` substitui o padrão da ação (ex.: cadastros do verificado). */
  async executar(
    usuarioId: string,
    acao: AcaoLimitada,
    agora: Date,
    limite?: number,
  ): Promise<void> {
    const usos = await this.usos.incrementar(usuarioId, acao, diaAtual(agora));
    if (passouDoLimite(acao, usos, limite)) {
      throw new ForbiddenError(
        'Você chegou ao limite de ações de hoje. Amanhã dá para continuar.',
        'limite_diario',
      );
    }
  }
}

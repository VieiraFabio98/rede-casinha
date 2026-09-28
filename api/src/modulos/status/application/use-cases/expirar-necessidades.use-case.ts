import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import {
  STATUS_REPOSITORY,
  type StatusRepository,
} from '../../domain/repositories/status.repository.js';
import { RecalcularStatusUseCase } from './recalcular-status.use-case.js';

const LOTE = 500;

/**
 * Expira as necessidades abertas cujo prazo passou (RN02): status `expirada`, uma atividade
 * `expiracao` (sem autor) e o status da casinha recalculado. Idempotente. Devolve quantas expirou.
 */
@Injectable()
export class ExpirarNecessidadesUseCase {
  constructor(
    @Inject(STATUS_REPOSITORY) private readonly repositorio: StatusRepository,
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    private readonly recalcular: RecalcularStatusUseCase,
  ) {}

  async executar(agora: Date = this.relogio.agora()): Promise<number> {
    let total = 0;
    for (;;) {
      const casinhas = await this.repositorio.casinhasComVencidas(agora, LOTE);
      if (casinhas.length === 0) return total;
      for (const casinhaId of casinhas) {
        total += await this.transacao.executar(async () => {
          await this.repositorio.travar(casinhaId);
          // Relidas com a casinha travada: alguém pode ter reconfirmado ("ainda precisa") agora há pouco.
          const ids = await this.repositorio.vencidas(casinhaId, agora);
          if (ids.length === 0) return 0;
          await this.repositorio.expirar(casinhaId, ids, agora);
          await this.recalcular.executar(casinhaId, agora);
          return ids.length;
        });
      }
    }
  }
}

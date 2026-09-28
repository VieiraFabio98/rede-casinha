import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import { calcularStatus } from '../../domain/regras.js';
import {
  STATUS_REPOSITORY,
  type StatusRepository,
} from '../../domain/repositories/status.repository.js';
import { RecalcularStatusUseCase } from './recalcular-status.use-case.js';

const LOTE = 500;

/**
 * Transições só pelo tempo (RN01): água/ração aberta há mais de 48 h → urgente; 7 dias sem
 * atividade → sem notícias. Grava só o que mudou. Idempotente. Devolve quantas mudaram.
 */
@Injectable()
export class RecalcularStatusDeTodasUseCase {
  constructor(
    @Inject(STATUS_REPOSITORY) private readonly repositorio: StatusRepository,
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    private readonly recalcular: RecalcularStatusUseCase,
  ) {}

  async executar(agora: Date = this.relogio.agora()): Promise<number> {
    let mudaram = 0;
    let depoisDe: string | null = null;
    for (;;) {
      const lote = await this.repositorio.loteParaRecalculo(depoisDe, LOTE);
      if (lote.length === 0) return mudaram;
      depoisDe = lote[lote.length - 1].id;

      // Leitura sem trava para achar candidatas; a gravação trava e relê (pode ter mudado).
      const candidatas = lote.filter(
        (c) => calcularStatus(c.abertas, c.ultimaAtividadeEm, agora) !== c.status,
      );
      for (const { id, status: anterior } of candidatas) {
        const novo = await this.transacao.executar(async () => {
          await this.repositorio.travar(id);
          return this.recalcular.executar(id, agora);
        });
        if (novo !== anterior) mudaram++;
      }
    }
  }
}

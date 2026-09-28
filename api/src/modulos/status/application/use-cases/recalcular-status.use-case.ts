import { Inject, Injectable } from '@nestjs/common';

import type { StatusCasinha } from '../../domain/entities/status-casinha.js';
import { calcularStatus } from '../../domain/regras.js';
import {
  STATUS_REPOSITORY,
  type StatusRepository,
} from '../../domain/repositories/status.repository.js';

/**
 * Recalcula o status da casinha (RN01) e grava se mudou. Roda na transação de quem chama:
 * toda escrita que afeta a casinha chama este use-case, então o mapa nunca fica desatualizado.
 */
@Injectable()
export class RecalcularStatusUseCase {
  constructor(@Inject(STATUS_REPOSITORY) private readonly repositorio: StatusRepository) {}

  async executar(casinhaId: string, agora: Date): Promise<StatusCasinha> {
    const dados = await this.repositorio.dados(casinhaId);
    const status = calcularStatus(dados.abertas, dados.ultimaAtividadeEm, agora);
    if (status !== dados.status) await this.repositorio.gravarStatus(casinhaId, status);
    return status;
  }
}

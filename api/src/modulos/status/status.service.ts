import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { calcularStatus } from './regras.js';

@Injectable()
export class StatusService {
  /**
   * Recalcula o status da casinha (RN01). Chamado dentro da MESMA transação de toda escrita
   * que afeta a casinha, para o mapa nunca mostrar um status desatualizado.
   */
  async recalcular(tx: Prisma.TransactionClient, casinhaId: string, agora: Date) {
    const casinha = await tx.casinha.findUniqueOrThrow({
      where: { id: casinhaId },
      select: {
        status: true,
        ultimaAtividadeEm: true,
        necessidades: {
          where: { status: 'aberta' },
          select: { tipo: true, urgencia: true, criadaEm: true },
        },
      },
    });
    const status = calcularStatus(casinha.necessidades, casinha.ultimaAtividadeEm, agora);
    if (status !== casinha.status) {
      await tx.casinha.update({ where: { id: casinhaId }, data: { status } });
    }
    return status;
  }
}

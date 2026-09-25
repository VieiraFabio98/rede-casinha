import { ForbiddenException, Injectable } from '@nestjs/common';

import { diaAtual } from '../../comum/tempo.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** Limites diários por usuário (RN06). */
export const LIMITES = {
  /** Reportes, atendimentos, check-ins e reconfirmações, somados. */
  contribuicoes: 60,
} as const;

export type AcaoLimitada = keyof typeof LIMITES;

@Injectable()
export class LimitesService {
  /**
   * Conta 1 uso da ação no dia e recusa se passar do limite. Dentro da transação da escrita:
   * se a escrita falhar, o uso não é contado.
   *
   * Responde 403 (não 429): é regra de negócio, e a fila do celular não deve insistir.
   */
  async consumir(tx: Prisma.TransactionClient, usuarioId: string, acao: AcaoLimitada, agora: Date) {
    const [{ quantidade }] = await tx.$queryRaw<{ quantidade: number }[]>`
      INSERT INTO limites_uso (usuario_id, acao, dia, quantidade)
      VALUES (${usuarioId}::uuid, ${acao}, ${diaAtual(agora)}::date, 1)
      ON CONFLICT (usuario_id, acao, dia)
      DO UPDATE SET quantidade = limites_uso.quantidade + 1
      RETURNING quantidade`;
    if (quantidade > LIMITES[acao]) {
      throw new ForbiddenException({
        message: 'Você chegou ao limite de ações de hoje. Amanhã dá para continuar.',
        codigo: 'limite_diario',
      });
    }
  }
}

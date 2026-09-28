import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { AcaoLimitada } from '../../domain/limites.js';
import type { LimitesUsoRepository } from '../../domain/repositories/limites-uso.repository.js';

@Injectable()
export class PrismaLimitesUsoRepository implements LimitesUsoRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async incrementar(usuarioId: string, acao: AcaoLimitada, dia: Date) {
    const [{ quantidade }] = await this.db.cliente().$queryRaw<{ quantidade: number }[]>`
      INSERT INTO limites_uso (usuario_id, acao, dia, quantidade)
      VALUES (${usuarioId}::uuid, ${acao}, ${dia}::date, 1)
      ON CONFLICT (usuario_id, acao, dia)
      DO UPDATE SET quantidade = limites_uso.quantidade + 1
      RETURNING quantidade`;
    return quantidade;
  }
}

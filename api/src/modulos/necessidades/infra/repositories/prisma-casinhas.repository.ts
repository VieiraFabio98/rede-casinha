import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { CasinhasRepository } from '../../domain/repositories/casinhas.repository.js';

@Injectable()
export class PrismaCasinhasRepository implements CasinhasRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async registrarVisita(casinhaId: string, em: Date) {
    await this.db
      .cliente()
      .casinha.update({ where: { id: casinhaId }, data: { ultimaAtividadeEm: em } });
  }

  async statusAtual(casinhaId: string) {
    const { status } = await this.db.cliente().casinha.findUniqueOrThrow({
      where: { id: casinhaId },
      select: { status: true },
    });
    return status;
  }
}

import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { AdocoesRepository } from '../../domain/repositories/adocoes.repository.js';

@Injectable()
export class PrismaAdocoesRepository implements AdocoesRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async adotaAtivamente(usuarioId: string, casinhaId: string) {
    return (
      (await this.db.cliente().adocao.count({ where: { casinhaId, usuarioId, ativa: true } })) > 0
    );
  }

  contarAtivas(casinhaId: string) {
    return this.db.cliente().adocao.count({ where: { casinhaId, ativa: true } });
  }

  async adotar(casinhaId: string, usuarioId: string, em: Date) {
    const db = this.db.cliente();
    await db.adocao.create({ data: { casinhaId, usuarioId, iniciadaEm: em } });
    await db.atividade.create({ data: { casinhaId, tipo: 'adocao', usuarioId, criadaEm: em } });
  }

  async encerrar(casinhaId: string, usuarioId: string, em: Date) {
    const db = this.db.cliente();
    const { count } = await db.adocao.updateMany({
      where: { casinhaId, usuarioId, ativa: true },
      data: { ativa: false, encerradaEm: em },
    });
    if (count > 0) {
      await db.atividade.create({
        data: { casinhaId, tipo: 'fim_adocao', usuarioId, criadaEm: em },
      });
    }
    return count > 0;
  }
}

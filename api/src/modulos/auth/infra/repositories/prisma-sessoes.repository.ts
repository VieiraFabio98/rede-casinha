import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { Sessao } from '../../domain/entities/conta.js';
import type { SessoesRepository } from '../../domain/repositories/sessoes.repository.js';

const CAMPOS = {
  id: true,
  usuarioId: true,
  expiraEm: true,
  revogadaEm: true,
  substituidaPor: true,
} as const;

@Injectable()
export class PrismaSessoesRepository implements SessoesRepository {
  constructor(private readonly db: PrismaTransacional) {}

  criar(dados: { usuarioId: string; refreshHash: string; expiraEm: Date }): Promise<Sessao> {
    return this.db.cliente().sessao.create({ data: dados, select: CAMPOS });
  }

  buscarPorRefresh(refreshHash: string): Promise<Sessao | null> {
    return this.db.cliente().sessao.findUnique({ where: { refreshHash }, select: CAMPOS });
  }

  async substituir(id: string, novaId: string, em: Date) {
    const { count } = await this.db.cliente().sessao.updateMany({
      where: { id, substituidaPor: null, revogadaEm: null },
      data: { substituidaPor: novaId, revogadaEm: em },
    });
    return count > 0;
  }

  async revogarPorRefresh(refreshHash: string, em: Date) {
    await this.db.cliente().sessao.updateMany({
      where: { refreshHash, revogadaEm: null },
      data: { revogadaEm: em },
    });
  }

  async revogarTodas(usuarioId: string, em: Date) {
    await this.db.cliente().sessao.updateMany({
      where: { usuarioId, revogadaEm: null },
      data: { revogadaEm: em },
    });
  }
}

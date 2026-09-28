import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { NovaAtividade, TipoAtividade } from '../../domain/entities/atividade.js';
import type { AtividadesRepository } from '../../domain/repositories/atividades.repository.js';

@Injectable()
export class PrismaAtividadesRepository implements AtividadesRepository {
  constructor(private readonly db: PrismaTransacional) {}

  buscarPorId(id: string) {
    return this.db.cliente().atividade.findUnique({
      where: { id },
      select: { usuarioId: true, necessidadeId: true },
    });
  }

  async existeDoUsuarioDesde(filtro: {
    necessidadeId: string;
    usuarioId: string;
    tipos: TipoAtividade[];
    desde: Date;
  }) {
    const encontrada = await this.db.cliente().atividade.findFirst({
      where: {
        necessidadeId: filtro.necessidadeId,
        usuarioId: filtro.usuarioId,
        tipo: { in: filtro.tipos },
        criadaEm: { gt: filtro.desde },
      },
      select: { id: true },
    });
    return encontrada !== null;
  }

  async registrar(nova: NovaAtividade) {
    await this.db.cliente().atividade.create({ data: nova });
  }
}

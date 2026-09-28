import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { NovaFoto } from '../../domain/entities/foto.js';
import type { FotosRepository } from '../../domain/repositories/fotos.repository.js';

@Injectable()
export class PrismaFotosRepository implements FotosRepository {
  constructor(private readonly db: PrismaTransacional) {}

  buscar(id: string) {
    return this.db.cliente().foto.findUnique({
      where: { id },
      select: {
        id: true,
        casinhaId: true,
        atividadeId: true,
        chave: true,
        chaveMiniatura: true,
        enviadaPorId: true,
        moderacao: true,
      },
    });
  }

  async criar(foto: NovaFoto) {
    await this.db.cliente().foto.create({ data: foto });
  }

  contarDaCasinha(casinhaId: string) {
    return this.db
      .cliente()
      .foto.count({ where: { casinhaId, atividadeId: null, moderacao: 'visivel' } });
  }

  async atividade(atividadeId: string) {
    const a = await this.db.cliente().atividade.findUnique({
      where: { id: atividadeId },
      select: { casinhaId: true, usuarioId: true, _count: { select: { fotos: true } } },
    });
    return a
      ? { casinhaId: a.casinhaId, usuarioId: a.usuarioId, jaTemFoto: a._count.fotos > 0 }
      : null;
  }

  async adotaAtivamente(usuarioId: string, casinhaId: string) {
    return (
      (await this.db.cliente().adocao.count({ where: { casinhaId, usuarioId, ativa: true } })) > 0
    );
  }

  expiradas(agora: Date, limite: number) {
    return this.db.cliente().foto.findMany({
      where: { expiraEm: { lte: agora } },
      select: { id: true, chave: true, chaveMiniatura: true },
      orderBy: { expiraEm: 'asc' },
      take: limite,
    });
  }

  async apagar(ids: string[]) {
    await this.db.cliente().foto.deleteMany({ where: { id: { in: ids } } });
  }
}

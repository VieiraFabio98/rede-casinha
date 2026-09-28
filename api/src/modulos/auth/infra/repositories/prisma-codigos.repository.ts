import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { CodigosRepository } from '../../domain/repositories/codigos.repository.js';

@Injectable()
export class PrismaCodigosRepository implements CodigosRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async ultimoPedidoEm(email: string) {
    const ultimo = await this.db.cliente().codigoEmail.findFirst({
      where: { email },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    return ultimo?.criadoEm ?? null;
  }

  contarPedidosDesde(email: string, desde: Date) {
    return this.db.cliente().codigoEmail.count({ where: { email, criadoEm: { gt: desde } } });
  }

  async expirarPendentes(email: string, agora: Date) {
    await this.db.cliente().codigoEmail.updateMany({
      where: { email, usadoEm: null, expiraEm: { gt: agora } },
      data: { expiraEm: agora },
    });
  }

  async criar(dados: { email: string; codigoHash: string; criadoEm: Date; expiraEm: Date }) {
    await this.db.cliente().codigoEmail.create({ data: dados });
  }

  pendenteMaisRecente(email: string, agora: Date) {
    return this.db.cliente().codigoEmail.findFirst({
      where: { email, usadoEm: null, expiraEm: { gt: agora } },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, codigoHash: true, tentativas: true },
    });
  }

  async registrarTentativa(id: string) {
    await this.db.cliente().codigoEmail.update({
      where: { id },
      data: { tentativas: { increment: 1 } },
    });
  }

  async marcarUsado(id: string, em: Date) {
    const { count } = await this.db.cliente().codigoEmail.updateMany({
      where: { id, usadoEm: null },
      data: { usadoEm: em },
    });
    return count > 0;
  }
}

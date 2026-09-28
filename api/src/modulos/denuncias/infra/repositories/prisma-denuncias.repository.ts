import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { Alvo } from '../../../moderacao/domain/entities/denuncia.js';
import type {
  DenunciasRepository,
  NovaDenuncia,
} from '../../domain/repositories/denuncias.repository.js';

@Injectable()
export class PrismaDenunciasRepository implements DenunciasRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async casinhaDoAlvo(alvo: Alvo) {
    const db = this.db.cliente();
    switch (alvo.alvoTipo) {
      case 'casinha':
        return (await db.casinha.count({ where: { id: alvo.alvoId } })) ? alvo.alvoId : null;
      case 'necessidade':
        return (await db.necessidade.findUnique({ where: { id: alvo.alvoId } }))?.casinhaId ?? null;
      case 'foto':
        return (await db.foto.findUnique({ where: { id: alvo.alvoId } }))?.casinhaId ?? null;
      case 'perfil':
        return null;
    }
  }

  async perfilExiste(id: string) {
    return (await this.db.cliente().perfil.count({ where: { id } })) > 0;
  }

  async jaDenunciou(alvoId: string, denuncianteId: string) {
    const d = await this.db.cliente().denuncia.findUnique({
      where: { alvoId_denuncianteId: { alvoId, denuncianteId } },
      select: { id: true },
    });
    return d !== null;
  }

  async criar(nova: NovaDenuncia) {
    await this.db.cliente().denuncia.create({ data: nova });
  }

  contarAbertasDeContasAntigas(alvoId: string, contasCriadasAte: Date) {
    return this.db.cliente().denuncia.count({
      where: {
        alvoId,
        status: 'aberta',
        denunciante: { usuario: { criadoEm: { lte: contasCriadasAte } } },
      },
    });
  }

  async atividadeExiste(id: string) {
    return (await this.db.cliente().atividade.count({ where: { id } })) > 0;
  }

  async registrarPedidoDeDesativacao(dados: {
    atividadeId: string;
    casinhaId: string;
    usuarioId: string;
    motivo: string;
    em: Date;
  }) {
    await this.db.cliente().atividade.create({
      data: {
        id: dados.atividadeId,
        casinhaId: dados.casinhaId,
        tipo: 'desativacao_pedida',
        usuarioId: dados.usuarioId,
        observacao: dados.motivo,
        criadaEm: dados.em,
      },
    });
  }
}

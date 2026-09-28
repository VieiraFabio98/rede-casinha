import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { StatusCasinha } from '../../domain/entities/status-casinha.js';
import type {
  DadosParaStatus,
  StatusRepository,
} from '../../domain/repositories/status.repository.js';

const SELECAO = {
  id: true,
  status: true,
  ultimaAtividadeEm: true,
  necessidades: {
    where: { status: 'aberta' as const },
    select: { tipo: true, urgencia: true, criadaEm: true },
  },
};

type Linha = {
  id: string;
  status: StatusCasinha;
  ultimaAtividadeEm: Date;
  necessidades: DadosParaStatus['abertas'];
};

const paraDados = (l: Linha): DadosParaStatus => ({
  id: l.id,
  status: l.status,
  ultimaAtividadeEm: l.ultimaAtividadeEm,
  abertas: l.necessidades,
});

@Injectable()
export class PrismaStatusRepository implements StatusRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async travar(casinhaId: string) {
    await this.db.cliente()
      .$queryRaw`SELECT 1 FROM casinhas WHERE id = ${casinhaId}::uuid FOR UPDATE`;
  }

  async dados(casinhaId: string) {
    return paraDados(
      await this.db
        .cliente()
        .casinha.findUniqueOrThrow({ where: { id: casinhaId }, select: SELECAO }),
    );
  }

  async gravarStatus(casinhaId: string, status: StatusCasinha) {
    await this.db.cliente().casinha.update({ where: { id: casinhaId }, data: { status } });
  }

  async loteParaRecalculo(depoisDe: string | null, tamanho: number) {
    const linhas = await this.db.cliente().casinha.findMany({
      where: { situacao: { not: 'inativa' }, ...(depoisDe && { id: { gt: depoisDe } }) },
      orderBy: { id: 'asc' },
      take: tamanho,
      select: SELECAO,
    });
    return linhas.map(paraDados);
  }

  async casinhasComVencidas(agora: Date, tamanho: number) {
    const linhas = await this.db.cliente().necessidade.findMany({
      where: { status: 'aberta', expiraEm: { lte: agora } },
      select: { casinhaId: true },
      distinct: ['casinhaId'],
      take: tamanho,
    });
    return linhas.map((l) => l.casinhaId);
  }

  async vencidas(casinhaId: string, agora: Date) {
    const linhas = await this.db.cliente().necessidade.findMany({
      where: { casinhaId, status: 'aberta', expiraEm: { lte: agora } },
      select: { id: true },
    });
    return linhas.map((l) => l.id);
  }

  async expirar(casinhaId: string, necessidadeIds: string[], agora: Date) {
    const db = this.db.cliente();
    await db.necessidade.updateMany({
      where: { id: { in: necessidadeIds } },
      data: { status: 'expirada' },
    });
    await db.atividade.createMany({
      data: necessidadeIds.map((necessidadeId) => ({
        casinhaId,
        necessidadeId,
        tipo: 'expiracao' as const,
        criadaEm: agora,
      })),
    });
  }
}

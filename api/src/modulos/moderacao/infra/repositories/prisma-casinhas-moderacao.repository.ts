import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { SituacaoCasinha } from '../../../casinhas/domain/entities/casinha.js';
import type { CasinhasModeracaoRepository } from '../../domain/repositories/casinhas-moderacao.repository.js';

const SELECAO_CASINHA = { id: true, nome: true, situacao: true, moderacao: true } as const;

@Injectable()
export class PrismaCasinhasModeracaoRepository implements CasinhasModeracaoRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async travar(...casinhaIds: string[]) {
    // Sempre na mesma ordem: duas mesclas cruzadas não travam uma à outra (deadlock).
    for (const id of [...casinhaIds].sort()) {
      const [linha] = await this.db.cliente().$queryRaw<{ id: string }[]>`
        SELECT id FROM casinhas WHERE id = ${id}::uuid FOR UPDATE`;
      if (!linha) return false;
    }
    return true;
  }

  emRevisao() {
    return this.db.cliente().casinha.findMany({
      where: { situacao: 'em_revisao' },
      select: SELECAO_CASINHA,
      orderBy: { criadaEm: 'asc' },
    });
  }

  porIds(ids: string[]) {
    return this.db
      .cliente()
      .casinha.findMany({ where: { id: { in: ids } }, select: SELECAO_CASINHA });
  }

  async pedidosDeDesativacao() {
    const pedidos = await this.db.cliente().atividade.findMany({
      where: { tipo: 'desativacao_pedida', casinha: { situacao: { not: 'inativa' } } },
      orderBy: { criadaEm: 'asc' },
      include: { casinha: { select: SELECAO_CASINHA }, usuario: { select: { apelido: true } } },
    });
    return pedidos.map((p) => ({
      atividadeId: p.id,
      casinha: p.casinha,
      apelido: p.usuario?.apelido ?? null,
      motivo: p.observacao,
      criadoEm: p.criadaEm,
    }));
  }

  async mudarSituacao(casinhaId: string, situacao: SituacaoCasinha) {
    await this.db.cliente().casinha.update({ where: { id: casinhaId }, data: { situacao } });
  }

  situacaoEUltimaAtividade(casinhaId: string) {
    return this.db.cliente().casinha.findUniqueOrThrow({
      where: { id: casinhaId },
      select: { situacao: true, ultimaAtividadeEm: true },
    });
  }

  necessidadesAbertas(casinhaId: string) {
    return this.db.cliente().necessidade.findMany({
      where: { casinhaId, status: 'aberta' },
      select: { id: true, tipo: true },
    });
  }

  async cancelarNecessidade(id: string) {
    await this.db.cliente().necessidade.update({ where: { id }, data: { status: 'cancelada' } });
  }

  adotantesAtivos(casinhaId: string) {
    return this.db.cliente().adocao.findMany({
      where: { casinhaId, ativa: true },
      select: { id: true, usuarioId: true },
    });
  }

  async encerrarAdocao(adocaoId: string, em: Date) {
    await this.db.cliente().adocao.update({
      where: { id: adocaoId },
      data: { ativa: false, encerradaEm: em },
    });
  }

  async moverTudo(origemId: string, destinoId: string) {
    const db = this.db.cliente();
    const para = { where: { casinhaId: origemId }, data: { casinhaId: destinoId } };
    await db.necessidade.updateMany(para);
    await db.adocao.updateMany(para);
    await db.atividade.updateMany(para);
    await db.foto.updateMany(para);
  }

  async marcarMesclada(origemId: string, destinoId: string) {
    await this.db.cliente().casinha.update({
      where: { id: origemId },
      data: { situacao: 'inativa', mescladaEmId: destinoId },
    });
  }

  async definirUltimaAtividade(casinhaId: string, em: Date) {
    await this.db.cliente().casinha.update({
      where: { id: casinhaId },
      data: { ultimaAtividadeEm: em },
    });
  }
}

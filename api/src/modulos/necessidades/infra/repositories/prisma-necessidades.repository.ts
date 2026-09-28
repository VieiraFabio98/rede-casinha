import { Injectable } from '@nestjs/common';

import type { Necessidade as LinhaNecessidade } from '../../../../generated/prisma/client.js';
import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type {
  MudancasNecessidade,
  Necessidade,
  NovaNecessidade,
  TipoNecessidade,
} from '../../domain/entities/necessidade.js';
import type { NecessidadesRepository } from '../../domain/repositories/necessidades.repository.js';

/** Linha do banco → entidade (sem `validado_local` nem campos internos). */
function paraEntidade(l: LinhaNecessidade): Necessidade {
  return {
    id: l.id,
    casinhaId: l.casinhaId,
    tipo: l.tipo,
    urgencia: l.urgencia,
    observacao: l.observacao,
    status: l.status,
    criadaPorId: l.criadaPorId,
    criadaEm: l.criadaEm,
    expiraEm: l.expiraEm,
    atendidaPorId: l.atendidaPorId,
    atendidaEm: l.atendidaEm,
  };
}

@Injectable()
export class PrismaNecessidadesRepository implements NecessidadesRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async buscarPorId(id: string) {
    const linha = await this.db.cliente().necessidade.findUnique({ where: { id } });
    return linha && paraEntidade(linha);
  }

  async buscarAberta(casinhaId: string, tipo: TipoNecessidade) {
    const linha = await this.db
      .cliente()
      .necessidade.findFirst({ where: { casinhaId, tipo, status: 'aberta' } });
    return linha && paraEntidade(linha);
  }

  async criar(nova: NovaNecessidade) {
    await this.db.cliente().necessidade.create({ data: nova });
  }

  async atualizar(id: string, mudancas: MudancasNecessidade) {
    await this.db.cliente().necessidade.update({ where: { id }, data: mudancas });
  }
}

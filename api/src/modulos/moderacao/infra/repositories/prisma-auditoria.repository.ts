import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { AcaoDeModeracao } from '../../domain/entities/denuncia.js';
import type { AuditoriaRepository } from '../../domain/repositories/auditoria.repository.js';

@Injectable()
export class PrismaAuditoriaRepository implements AuditoriaRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async registrar(acao: AcaoDeModeracao) {
    await this.db.cliente().acaoModeracao.create({ data: acao });
  }

  async ultimasAtivacoes(casinhaIds: string[]) {
    const linhas = await this.db.cliente().acaoModeracao.findMany({
      where: { acao: 'ativar', alvoId: { in: casinhaIds } },
      select: { alvoId: true, criadaEm: true },
    });
    const ultimas = new Map<string, Date>();
    for (const l of linhas) {
      const atual = ultimas.get(l.alvoId);
      if (!atual || l.criadaEm > atual) ultimas.set(l.alvoId, l.criadaEm);
    }
    return ultimas;
  }
}

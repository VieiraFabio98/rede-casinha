import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { DenunciasModeracaoRepository } from '../../domain/repositories/denuncias.repository.js';

@Injectable()
export class PrismaDenunciasModeracaoRepository implements DenunciasModeracaoRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async abertas() {
    const linhas = await this.db.cliente().denuncia.findMany({
      where: { status: 'aberta' },
      orderBy: { criadaEm: 'asc' },
      include: { denunciante: { select: { apelido: true } } },
    });
    return linhas.map((d) => ({
      id: d.id,
      alvoTipo: d.alvoTipo,
      alvoId: d.alvoId,
      motivo: d.motivo,
      descricao: d.descricao,
      apelido: d.denunciante?.apelido ?? null,
      criadaEm: d.criadaEm,
    }));
  }

  async existe(id: string) {
    return (await this.db.cliente().denuncia.count({ where: { id } })) > 0;
  }

  async fecharDoAlvo(alvoId: string, procedente: boolean, moderadorId: string, em: Date) {
    await this.db.cliente().denuncia.updateMany({
      where: { alvoId, status: 'aberta' },
      data: {
        status: procedente ? 'procedente' : 'improcedente',
        resolvidaPorId: moderadorId,
        resolvidaEm: em,
      },
    });
  }

  async resolver(id: string, procedente: boolean, moderadorId: string, em: Date) {
    await this.db.cliente().denuncia.update({
      where: { id },
      data: {
        status: procedente ? 'procedente' : 'improcedente',
        resolvidaPorId: moderadorId,
        resolvidaEm: em,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';

import type { NivelAcesso } from '../../../../shared/domain/usuario-logado.js';
import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { UsuariosModeracaoRepository } from '../../domain/repositories/usuarios-moderacao.repository.js';

@Injectable()
export class PrismaUsuariosModeracaoRepository implements UsuariosModeracaoRepository {
  constructor(private readonly db: PrismaTransacional) {}

  perfil(id: string) {
    return this.db.cliente().perfil.findUnique({
      where: { id },
      select: { id: true, apelido: true, nivel: true, verificadoPorId: true, bloqueadoAte: true },
    });
  }

  async alterarNivel(id: string, nivel: NivelAcesso, verificadoPorId: string | null) {
    await this.db.cliente().perfil.update({ where: { id }, data: { nivel, verificadoPorId } });
  }

  async bloquear(id: string, ate: Date | null) {
    await this.db.cliente().perfil.update({ where: { id }, data: { bloqueadoAte: ate } });
  }
}

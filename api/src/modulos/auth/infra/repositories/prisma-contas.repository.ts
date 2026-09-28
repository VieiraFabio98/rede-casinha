import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { Conta } from '../../domain/entities/conta.js';
import type { ContasRepository } from '../../domain/repositories/contas.repository.js';

const CAMPOS = {
  id: true,
  email: true,
  googleSub: true,
  senhaHash: true,
  emailVerificadoEm: true,
} as const;

@Injectable()
export class PrismaContasRepository implements ContasRepository {
  constructor(private readonly db: PrismaTransacional) {}

  buscarPorGoogle(googleSub: string): Promise<Conta | null> {
    return this.db.cliente().usuario.findUnique({ where: { googleSub }, select: CAMPOS });
  }

  buscarPorEmail(email: string): Promise<Conta | null> {
    return this.db.cliente().usuario.findUnique({ where: { email }, select: CAMPOS });
  }

  criar(dados: { email: string; googleSub: string; emailVerificadoEm: Date }): Promise<Conta> {
    return this.db.cliente().usuario.create({ data: dados, select: CAMPOS });
  }

  buscarOuCriarPorEmail(email: string, verificadoEm: Date): Promise<Conta> {
    return this.db.cliente().usuario.upsert({
      where: { email },
      create: { email, emailVerificadoEm: verificadoEm },
      update: {},
      select: CAMPOS,
    });
  }

  vincularGoogle(id: string, googleSub: string, emailVerificadoEm: Date): Promise<Conta> {
    return this.db.cliente().usuario.update({
      where: { id },
      data: { googleSub, emailVerificadoEm },
      select: CAMPOS,
    });
  }

  async marcarEmailVerificado(id: string, em: Date) {
    await this.db.cliente().usuario.update({ where: { id }, data: { emailVerificadoEm: em } });
  }

  async temPerfil(id: string) {
    return (await this.db.cliente().perfil.count({ where: { id } })) > 0;
  }
}

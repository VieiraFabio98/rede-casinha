import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type {
  ContasRepository,
  NovoPerfil,
  ResultadoCriarPerfil,
} from '../../domain/repositories/contas.repository.js';

const TIPOS_DE_CONTRIBUICAO = ['reporte', 'reconfirmacao', 'atendimento', 'check_in'] as const;

@Injectable()
export class PrismaContasRepository implements ContasRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async buscar(usuarioId: string) {
    const usuario = await this.db.cliente().usuario.findUnique({
      where: { id: usuarioId },
      include: { perfil: true },
    });
    if (!usuario) return null;
    const { perfil } = usuario;
    return {
      id: usuario.id,
      email: usuario.email,
      perfil: perfil && {
        apelido: perfil.apelido,
        nivel: perfil.nivel,
        bloqueadoAte: perfil.bloqueadoAte,
      },
    };
  }

  async perfilExiste(usuarioId: string) {
    return (await this.db.cliente().perfil.count({ where: { id: usuarioId } })) > 0;
  }

  async criarPerfil(novo: NovoPerfil): Promise<ResultadoCriarPerfil> {
    try {
      const perfil = await this.db.cliente().perfil.create({
        data: {
          id: novo.usuarioId,
          apelido: novo.apelido,
          apelidoNormalizado: novo.apelidoNormalizado,
          maiorDeIdadeEm: novo.em,
          termosVersao: novo.termosVersao,
          termosAceitosEm: novo.em,
        },
      });
      return { apelido: perfil.apelido, nivel: perfil.nivel, bloqueadoAte: perfil.bloqueadoAte };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        return JSON.stringify(erro.meta ?? {}).includes('apelido')
          ? 'apelido_em_uso'
          : 'cadastro_existente';
      }
      throw erro;
    }
  }

  async contagens(usuarioId: string) {
    const db = this.db.cliente();
    const [contribuicoes, atendimentos, casinhasAdotadas] = await Promise.all([
      db.atividade.count({ where: { usuarioId, tipo: { in: [...TIPOS_DE_CONTRIBUICAO] } } }),
      db.atividade.count({ where: { usuarioId, tipo: 'atendimento' } }),
      db.adocao.count({ where: { usuarioId, ativa: true } }),
    ]);
    return { contribuicoes, atendimentos, casinhasAdotadas };
  }

  async excluir(usuarioId: string) {
    const db = this.db.cliente();
    const usuario = await db.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) return null;
    const fotos = await db.foto.findMany({
      where: { enviadaPorId: usuarioId },
      select: { chave: true, chaveMiniatura: true },
    });
    await db.foto.deleteMany({ where: { enviadaPorId: usuarioId } });
    await db.codigoEmail.deleteMany({ where: { email: usuario.email } });
    await db.usuario.delete({ where: { id: usuarioId } });
    return fotos.flatMap((f) => [f.chave, f.chaveMiniatura]);
  }
}

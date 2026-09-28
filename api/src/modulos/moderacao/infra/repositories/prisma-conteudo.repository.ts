import { Injectable } from '@nestjs/common';

import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { StatusModeracao } from '../../../casinhas/domain/entities/casinha.js';
import type { TipoNecessidade } from '../../../necessidades/domain/entities/necessidade.js';
import type { Alvo } from '../../domain/entities/denuncia.js';
import { ROTULO_NECESSIDADE } from '../../domain/regras.js';
import type { ConteudoRepository } from '../../domain/repositories/conteudo.repository.js';

@Injectable()
export class PrismaConteudoRepository implements ConteudoRepository {
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

  async ocultar(alvo: Alvo, automatico: boolean) {
    const db = this.db.cliente();
    const estado: StatusModeracao = automatico ? 'oculto_auto' : 'oculto_moderador';
    // A automática só age sobre o que está visível; a do moderador sobrepõe a automática.
    const onde = {
      id: alvo.alvoId,
      moderacao: automatico ? ('visivel' as const) : { not: estado },
    };
    switch (alvo.alvoTipo) {
      case 'casinha':
        return (
          (await db.casinha.updateMany({ where: onde, data: { moderacao: estado } })).count > 0
        );
      case 'foto':
        return (await db.foto.updateMany({ where: onde, data: { moderacao: estado } })).count > 0;
      case 'necessidade':
        return (
          (
            await db.necessidade.updateMany({
              where: { id: alvo.alvoId, status: 'aberta' },
              data: { status: 'cancelada' },
            })
          ).count > 0
        );
      case 'perfil':
        return false;
    }
  }

  async tornarVisivel(alvo: Alvo) {
    const db = this.db.cliente();
    const args = { where: { id: alvo.alvoId }, data: { moderacao: 'visivel' as const } };
    if (alvo.alvoTipo === 'casinha') return (await db.casinha.updateMany(args)).count > 0;
    if (alvo.alvoTipo === 'foto') return (await db.foto.updateMany(args)).count > 0;
    return false;
  }

  necessidade(id: string) {
    return this.db.cliente().necessidade.findUnique({
      where: { id },
      select: { casinhaId: true, tipo: true, status: true },
    });
  }

  async existeAbertaDoTipo(casinhaId: string, tipo: TipoNecessidade) {
    return (
      (await this.db
        .cliente()
        .necessidade.count({ where: { casinhaId, tipo, status: 'aberta' } })) > 0
    );
  }

  async reabrirNecessidade(id: string, expiraEm: Date) {
    await this.db.cliente().necessidade.update({
      where: { id },
      data: { status: 'aberta', expiraEm },
    });
  }

  async descrever(alvo: Alvo, agora: Date) {
    const db = this.db.cliente();
    const semAlvo = { descricaoAlvo: '(removido)', estadoAlvo: 'removido' };
    switch (alvo.alvoTipo) {
      case 'casinha': {
        const c = await db.casinha.findUnique({ where: { id: alvo.alvoId } });
        return c ? { descricaoAlvo: c.nome, estadoAlvo: `${c.situacao}, ${c.moderacao}` } : semAlvo;
      }
      case 'necessidade': {
        const n = await db.necessidade.findUnique({
          where: { id: alvo.alvoId },
          include: { casinha: { select: { nome: true } } },
        });
        return n
          ? {
              descricaoAlvo: `${ROTULO_NECESSIDADE[n.tipo]} em ${n.casinha.nome}`,
              estadoAlvo: n.status,
            }
          : semAlvo;
      }
      case 'foto': {
        const f = await db.foto.findUnique({
          where: { id: alvo.alvoId },
          include: { casinha: { select: { nome: true } } },
        });
        return f
          ? { descricaoAlvo: `foto de ${f.casinha.nome}`, estadoAlvo: f.moderacao }
          : semAlvo;
      }
      case 'perfil': {
        const p = await db.perfil.findUnique({ where: { id: alvo.alvoId } });
        const bloqueado = p?.bloqueadoAte && p.bloqueadoAte > agora;
        return p
          ? { descricaoAlvo: p.apelido, estadoAlvo: bloqueado ? 'bloqueado' : p.nivel }
          : semAlvo;
      }
    }
  }
}

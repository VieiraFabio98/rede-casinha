import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type {
  Area,
  CasinhaParaAcao,
  CasinhaResumo,
  NovaCasinha,
  SituacaoCasinha,
  StatusModeracao,
} from '../../domain/entities/casinha.js';
import type { CasinhasRepository } from '../../domain/repositories/casinhas.repository.js';
import { ATIVIDADES_NO_DETALHE } from '../../domain/visibilidade.js';

/** Colunas mínimas do mapa (a resposta de uma área com 200 casinhas tem que ser pequena). */
const SELECAO_MAPA = {
  id: true,
  nome: true,
  status: true,
  animais: true,
  latPublica: true,
  lngPublica: true,
  criadaPorId: true,
  necessidades: { where: { status: 'aberta' }, select: { tipo: true } },
} satisfies Prisma.CasinhaSelect;

type LinhaMapa = Prisma.CasinhaGetPayload<{ select: typeof SELECAO_MAPA }>;

const paraResumo = ({ necessidades, ...c }: LinhaMapa): CasinhaResumo => ({
  ...c,
  necessidadesAbertas: necessidades.map((n) => n.tipo),
});

@Injectable()
export class PrismaCasinhasRepository implements CasinhasRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async naArea(area: Area, limite: number) {
    const linhas = await this.db.cliente().casinha.findMany({
      where: {
        situacao: { not: 'inativa' },
        moderacao: 'visivel',
        latPublica: { gte: area.minLat, lte: area.maxLat },
        lngPublica: { gte: area.minLng, lte: area.maxLng },
      },
      select: SELECAO_MAPA,
      orderBy: { id: 'asc' },
      take: limite,
    });
    return linhas.map(paraResumo);
  }

  async doUsuario(usuarioId: string) {
    const linhas = await this.db.cliente().casinha.findMany({
      where: {
        situacao: { not: 'inativa' },
        OR: [{ criadaPorId: usuarioId }, { adocoes: { some: { usuarioId, ativa: true } } }],
      },
      select: {
        ...SELECAO_MAPA,
        adocoes: { where: { usuarioId, ativa: true }, select: { id: true } },
      },
      orderBy: { nome: 'asc' },
    });
    return linhas.map(({ adocoes, ...c }) => ({
      ...paraResumo(c),
      souAdotante: adocoes.length > 0,
    }));
  }

  async detalhe(id: string) {
    const c = await this.db.cliente().casinha.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        descricao: true,
        animais: true,
        status: true,
        situacao: true,
        moderacao: true,
        latPublica: true,
        lngPublica: true,
        criadaPorId: true,
        ultimaAtividadeEm: true,
        criadaEm: true,
        necessidades: {
          where: { status: 'aberta' },
          orderBy: { criadaEm: 'desc' },
          select: {
            id: true,
            tipo: true,
            urgencia: true,
            observacao: true,
            criadaEm: true,
            expiraEm: true,
          },
        },
        adocoes: {
          where: { ativa: true },
          orderBy: { iniciadaEm: 'asc' },
          select: { usuarioId: true, usuario: { select: { apelido: true } } },
        },
        atividades: {
          orderBy: { criadaEm: 'desc' },
          take: ATIVIDADES_NO_DETALHE,
          select: {
            id: true,
            tipo: true,
            observacao: true,
            criadaEm: true,
            usuario: { select: { apelido: true } },
            necessidade: { select: { tipo: true } },
            fotos: { where: { moderacao: 'visivel' }, select: { id: true }, take: 1 },
          },
        },
        fotos: {
          where: { atividadeId: null, moderacao: 'visivel' },
          orderBy: { criadaEm: 'asc' },
          select: { id: true },
        },
      },
    });
    if (!c) return null;
    const { necessidades, adocoes, atividades, fotos, ...resto } = c;
    return {
      ...resto,
      necessidadesAbertas: necessidades,
      adotantes: adocoes.map((a) => ({ usuarioId: a.usuarioId, apelido: a.usuario.apelido })),
      atividades: atividades.map(({ usuario, necessidade, fotos: [foto], ...a }) => ({
        ...a,
        necessidade: necessidade?.tipo ?? null,
        apelido: usuario?.apelido ?? null,
        fotoId: foto?.id ?? null,
      })),
      fotoIds: fotos.map((f) => f.id),
    };
  }

  async atendidasDesde(casinhaId: string, desde: Date) {
    const linhas = await this.db.cliente().necessidade.findMany({
      where: { casinhaId, status: 'atendida', atendidaEm: { gt: desde } },
      orderBy: { atendidaEm: 'desc' },
      select: {
        id: true,
        tipo: true,
        atendidaEm: true,
        atendidaPor: { select: { apelido: true } },
      },
    });
    return linhas.map(({ atendidaPor, atendidaEm, ...n }) => ({
      ...n,
      atendidaEm: atendidaEm!,
      apelido: atendidaPor?.apelido ?? null,
    }));
  }

  async travarParaAcao(casinhaId: string): Promise<CasinhaParaAcao | null> {
    const [c] = await this.db.cliente().$queryRaw<
      { situacao: SituacaoCasinha; moderacao: StatusModeracao; criada_por: string | null }[]
    >`SELECT situacao, moderacao, criada_por FROM casinhas WHERE id = ${casinhaId}::uuid FOR UPDATE`;
    return c ? { situacao: c.situacao, moderacao: c.moderacao, criadaPorId: c.criada_por } : null;
  }

  async adotaAtivamente(usuarioId: string, casinhaId: string) {
    return (
      (await this.db.cliente().adocao.count({ where: { casinhaId, usuarioId, ativa: true } })) > 0
    );
  }

  async travarId(id: string) {
    // Trava por id, não por linha: a linha ainda não existe no primeiro envio.
    await this.db.cliente().$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
  }

  existente(id: string) {
    return this.db.cliente().casinha.findUnique({
      where: { id },
      select: { criadaPorId: true, situacao: true },
    });
  }

  async criar({ criadaNoCelularEm, ...casinha }: NovaCasinha) {
    const db = this.db.cliente();
    // Sem necessidades e com atividade agora: começa "ok" (RN01).
    await db.casinha.create({
      data: { ...casinha, status: 'ok', ultimaAtividadeEm: casinha.criadaEm },
    });
    await db.atividade.create({
      data: {
        id: casinha.id,
        casinhaId: casinha.id,
        tipo: 'cadastro',
        usuarioId: casinha.criadaPorId,
        criadaEm: casinha.criadaEm,
        criadaNoCelularEm,
      },
    });
    await db.adocao.create({
      data: { casinhaId: casinha.id, usuarioId: casinha.criadaPorId, iniciadaEm: casinha.criadaEm },
    });
  }

  async candidatas(ids: string[]) {
    const linhas = await this.db.cliente().casinha.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        nome: true,
        fotos: {
          where: { atividadeId: null, moderacao: 'visivel' },
          orderBy: { criadaEm: 'asc' },
          select: { id: true },
          take: 1,
        },
      },
    });
    const porId = new Map(linhas.map((c) => [c.id, c]));
    return ids.flatMap((id) => {
      const c = porId.get(id);
      return c ? [{ id: c.id, nome: c.nome, fotoId: c.fotos[0]?.id ?? null }] : [];
    });
  }
}

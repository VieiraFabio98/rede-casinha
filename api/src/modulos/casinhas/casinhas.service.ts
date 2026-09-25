import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ORDEM_NIVEL } from '../../comum/auth/tipos.js';
import { Relogio } from '../../comum/relogio.js';
import type { Ponto } from '../../comum/geo.js';
import type { Perfil, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LocalizacaoService } from '../localizacao/localizacao.service.js';
import type {
  AreaDto,
  CasinhaDetalhe,
  CasinhaNoMapa,
  CasinhasNaAreaResposta,
  MinhaCasinha,
} from './casinhas.dto.js';
import { permissoesNaCasinha } from './permissoes.js';

/** Máximo de casinhas por busca de área. */
export const LIMITE_POR_AREA = 1_000;
const ATIVIDADES_NO_DETALHE = 30;
/** Janela em que um atendimento ainda pode ser contestado (RN03). */
const PRAZO_CONTESTACAO_MS = 24 * 60 * 60 * 1000;

/** 6 casas decimais (~11 cm): precisão de sobra e resposta menor. */
const arredondar = (grau: number) => Math.round(grau * 1e6) / 1e6;

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

/** O que aparece no mapa para todo mundo: ativa (ou em revisão) e não ocultada. */
const VISIVEL_NO_MAPA = {
  situacao: { not: 'inativa' },
  moderacao: 'visivel',
} satisfies Prisma.CasinhaWhereInput;

@Injectable()
export class CasinhasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localizacao: LocalizacaoService,
    private readonly relogio: Relogio,
  ) {}

  async listarNaArea(perfil: Perfil, area: AreaDto): Promise<CasinhasNaAreaResposta> {
    if (area.minLat > area.maxLat || area.minLng > area.maxLng) {
      throw new BadRequestException({
        message: 'Área inválida: o mínimo passa do máximo',
        codigo: 'area_invalida',
      });
    }
    const linhas = await this.prisma.casinha.findMany({
      where: {
        ...VISIVEL_NO_MAPA,
        latPublica: { gte: area.minLat, lte: area.maxLat },
        lngPublica: { gte: area.minLng, lte: area.maxLng },
      },
      select: SELECAO_MAPA,
      orderBy: { id: 'asc' },
      take: LIMITE_POR_AREA + 1,
    });
    const casinhas = linhas.slice(0, LIMITE_POR_AREA);
    const exatas = await this.localizacao.exatasParaLista(perfil, casinhas);
    return {
      casinhas: casinhas.map((c) => paraMapa(c, exatas.get(c.id))),
      truncado: linhas.length > LIMITE_POR_AREA,
    };
  }

  /** Casinhas que o perfil criou ou adota (inclusive as ocultadas por denúncia). */
  async minhas(perfil: Perfil): Promise<MinhaCasinha[]> {
    const linhas = await this.prisma.casinha.findMany({
      where: {
        situacao: { not: 'inativa' },
        OR: [
          { criadaPorId: perfil.id },
          { adocoes: { some: { usuarioId: perfil.id, ativa: true } } },
        ],
      },
      select: {
        ...SELECAO_MAPA,
        adocoes: { where: { usuarioId: perfil.id, ativa: true }, select: { id: true } },
      },
      orderBy: { nome: 'asc' },
    });
    const exatas = await this.localizacao.exatasParaLista(perfil, linhas);
    return linhas.map(({ adocoes, ...c }) => ({
      ...paraMapa(c, exatas.get(c.id)),
      souCriador: c.criadaPorId === perfil.id,
      souAdotante: adocoes.length > 0,
    }));
  }

  async detalhe(perfil: Perfil, id: string): Promise<CasinhaDetalhe> {
    const desde = new Date(this.relogio.agora().getTime() - PRAZO_CONTESTACAO_MS);
    const c = await this.prisma.casinha.findUnique({
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
          },
        },
      },
    });

    const moderador = ORDEM_NIVEL[perfil.nivel] >= ORDEM_NIVEL.moderador;
    const souCriador = c?.criadaPorId === perfil.id;
    const souAdotante = c?.adocoes.some((a) => a.usuarioId === perfil.id) ?? false;
    // Ocultada por denúncia: só moderador, criador e adotantes veem. Inativa: só moderador.
    const visivel =
      !!c &&
      (moderador ||
        (c.situacao !== 'inativa' && (c.moderacao === 'visivel' || souCriador || souAdotante)));
    if (!c || !visivel) throw new NotFoundException('Casinha não encontrada');

    const [exata, atendidas] = await Promise.all([
      this.localizacao.exataParaDetalhe(perfil, c),
      this.prisma.necessidade.findMany({
        where: { casinhaId: id, status: 'atendida', atendidaEm: { gt: desde } },
        orderBy: { atendidaEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          atendidaEm: true,
          atendidaPor: { select: { apelido: true } },
        },
      }),
    ]);
    return {
      id: c.id,
      nome: c.nome,
      descricao: c.descricao,
      animais: c.animais,
      status: c.status,
      ...coordenadas(c, exata ?? undefined),
      ultimaAtividadeEm: c.ultimaAtividadeEm,
      criadaEm: c.criadaEm,
      necessidadesAbertas: c.necessidades,
      atendidasRecentemente: atendidas.map(({ atendidaPor, atendidaEm, ...n }) => ({
        ...n,
        atendidaEm: atendidaEm!,
        apelido: atendidaPor?.apelido ?? null,
      })),
      adotantes: c.adocoes.map((a) => a.usuario.apelido),
      atividades: c.atividades.map(({ usuario, necessidade, ...a }) => ({
        ...a,
        necessidade: necessidade?.tipo ?? null,
        apelido: usuario?.apelido ?? null,
      })),
      minhasPermissoes: permissoesNaCasinha({
        nivel: perfil.nivel,
        souCriador,
        souAdotante,
        adotantesAtivos: c.adocoes.length,
      }),
    };
  }
}

function coordenadas(c: { latPublica: number; lngPublica: number }, exata?: Ponto) {
  return exata
    ? { lat: arredondar(exata.lat), lng: arredondar(exata.lng), exata: true }
    : { lat: arredondar(c.latPublica), lng: arredondar(c.lngPublica), exata: false };
}

function paraMapa(c: LinhaMapa, exata?: Ponto): CasinhaNoMapa {
  return {
    id: c.id,
    nome: c.nome,
    status: c.status,
    animais: c.animais,
    ...coordenadas(c, exata),
    necessidadesAbertas: c.necessidades.map((n) => n.tipo),
  };
}

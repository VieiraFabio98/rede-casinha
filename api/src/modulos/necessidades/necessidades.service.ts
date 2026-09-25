import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ORDEM_NIVEL } from '../../comum/auth/tipos.js';
import type { Ponto } from '../../comum/geo.js';
import { Relogio } from '../../comum/relogio.js';
import type { Necessidade, Perfil, Prisma, TipoAtividade } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LimitesService } from '../limites/limites.service.js';
import { LocalizacaoService } from '../localizacao/localizacao.service.js';
import { prazoExpiracao } from '../status/regras.js';
import { StatusService } from '../status/status.service.js';
import type {
  AcaoDto,
  AtenderDto,
  ContestarDto,
  ReportarNecessidadeDto,
  Resultado,
  ResultadoAcao,
} from './necessidades.dto.js';

type Tx = Prisma.TransactionClient;

const HORA = 60 * 60 * 1000;
/** RN02: cada usuário reconfirma a mesma necessidade no máximo 1 vez a cada 12 h. */
const INTERVALO_RECONFIRMACAO_MS = 12 * HORA;
/** RN03: contestação só até 24 h depois do atendimento. */
const PRAZO_CONTESTACAO_MS = 24 * HORA;

function posicaoDe(dto: { lat?: number; lng?: number }): Ponto | null {
  if (dto.lat === undefined && dto.lng === undefined) return null;
  if (dto.lat === undefined || dto.lng === undefined) {
    throw new BadRequestException('Mande lat e lng juntos (ou nenhum dos dois)');
  }
  return { lat: dto.lat, lng: dto.lng };
}

/** Hora do celular, mas nunca no futuro (relógio do aparelho errado). */
const horaDoCelular = (dto: { criadaNoCelularEm?: Date }, agora: Date) =>
  dto.criadaNoCelularEm && dto.criadaNoCelularEm < agora ? dto.criadaNoCelularEm : agora;

/**
 * Reportar, reconfirmar, atender, contestar e check-in (RN02, RN03).
 *
 * Toda ação:
 * - trava a linha da casinha (`FOR UPDATE`): ações simultâneas na mesma casinha viram uma fila;
 * - é idempotente pelo id gerado no celular (reenviar devolve sucesso sem repetir o efeito);
 * - grava a atividade, atualiza a casinha e recalcula o status na mesma transação.
 */
@Injectable()
export class NecessidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localizacao: LocalizacaoService,
    private readonly status: StatusService,
    private readonly limites: LimitesService,
    private readonly relogio: Relogio,
  ) {}

  reportar(perfil: Perfil, dto: ReportarNecessidadeDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.travarCasinha(tx, perfil, dto.casinhaId);
      const repetida = await this.atividadeRegistrada(tx, perfil, dto.id);
      if (repetida) return this.resposta(tx, dto.casinhaId, 'ok', repetida.necessidadeId);

      const agora = this.relogio.agora();
      await this.limites.consumir(tx, perfil.id, 'contribuicoes', agora);
      const validadoLocal = await this.localizacao.estaPerto(dto.casinhaId, posicao);
      const noCelular = horaDoCelular(dto, agora);

      // RN02: nunca duas abertas do mesmo tipo. Reportar de novo = "ainda precisa".
      const aberta = await tx.necessidade.findFirst({
        where: { casinhaId: dto.casinhaId, tipo: dto.tipo, status: 'aberta' },
      });
      let resultado: Resultado = 'ok';
      let necessidadeId = dto.id;
      if (aberta) {
        resultado = 'reconfirmada';
        necessidadeId = aberta.id;
        await tx.necessidade.update({
          where: { id: aberta.id },
          data: {
            expiraEm: prazoExpiracao(dto.tipo, agora),
            ...(dto.urgencia === 'urgente' && { urgencia: 'urgente' }),
          },
        });
      } else {
        await tx.necessidade.create({
          data: {
            id: dto.id,
            casinhaId: dto.casinhaId,
            tipo: dto.tipo,
            urgencia: dto.urgencia,
            observacao: dto.observacao,
            criadaPorId: perfil.id,
            criadaEm: agora,
            criadaNoCelularEm: noCelular,
            expiraEm: prazoExpiracao(dto.tipo, agora),
            validadoLocal,
          },
        });
      }

      await this.registrar(tx, {
        id: dto.id,
        casinhaId: dto.casinhaId,
        necessidadeId,
        tipo: aberta ? 'reconfirmacao' : 'reporte',
        usuarioId: perfil.id,
        observacao: dto.observacao,
        criadaEm: agora,
        criadaNoCelularEm: noCelular,
        validadoLocal,
      });
      return this.concluir(tx, dto.casinhaId, agora, resultado, necessidadeId);
    });
  }

  reconfirmar(perfil: Perfil, necessidadeId: string, dto: AcaoDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.naNecessidade(perfil, necessidadeId, dto.atividadeId, async (tx, n) => {
      if (n.status !== 'aberta') {
        throw new ConflictException({
          message: 'Este pedido já foi resolvido ou expirou.',
          codigo: 'necessidade_fechada',
        });
      }
      const agora = this.relogio.agora();
      const recente = await tx.atividade.findFirst({
        where: {
          necessidadeId,
          usuarioId: perfil.id,
          tipo: { in: ['reporte', 'reconfirmacao'] },
          criadaEm: { gt: new Date(agora.getTime() - INTERVALO_RECONFIRMACAO_MS) },
        },
      });
      // Já confirmou há pouco: não renova de novo nem conta no limite (não é um erro).
      if (recente) return this.resposta(tx, n.casinhaId, 'ja_reconfirmada', necessidadeId);

      await this.limites.consumir(tx, perfil.id, 'contribuicoes', agora);
      const validadoLocal = await this.localizacao.estaPerto(n.casinhaId, posicao);
      await tx.necessidade.update({
        where: { id: necessidadeId },
        data: { expiraEm: prazoExpiracao(n.tipo, agora) },
      });
      await this.registrar(tx, {
        id: dto.atividadeId,
        casinhaId: n.casinhaId,
        necessidadeId,
        tipo: 'reconfirmacao',
        usuarioId: perfil.id,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto, agora),
        validadoLocal,
      });
      return this.concluir(tx, n.casinhaId, agora, 'ok', necessidadeId);
    });
  }

  atender(perfil: Perfil, necessidadeId: string, dto: AtenderDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.naNecessidade(perfil, necessidadeId, dto.atividadeId, async (tx, n) => {
      const agora = this.relogio.agora();
      await this.limites.consumir(tx, perfil.id, 'contribuicoes', agora);
      const validadoLocal = await this.localizacao.estaPerto(n.casinhaId, posicao);

      // RN03: se já foi resolvida (ou expirou), o atendimento fica só no histórico.
      const resultado: Resultado = n.status === 'aberta' ? 'ok' : 'ja_atendida';
      if (resultado === 'ok') {
        await tx.necessidade.update({
          where: { id: necessidadeId },
          data: { status: 'atendida', atendidaPorId: perfil.id, atendidaEm: agora },
        });
      }
      await this.registrar(tx, {
        id: dto.atividadeId,
        casinhaId: n.casinhaId,
        necessidadeId,
        tipo: 'atendimento',
        usuarioId: perfil.id,
        observacao: dto.observacao,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto, agora),
        validadoLocal,
      });
      return this.concluir(tx, n.casinhaId, agora, resultado, necessidadeId);
    });
  }

  contestar(perfil: Perfil, necessidadeId: string, dto: ContestarDto): Promise<ResultadoAcao> {
    return this.naNecessidade(perfil, necessidadeId, dto.atividadeId, async (tx, n) => {
      const agora = this.relogio.agora();
      const dentroDoPrazo =
        n.status === 'atendida' &&
        n.atendidaEm !== null &&
        agora.getTime() - n.atendidaEm.getTime() <= PRAZO_CONTESTACAO_MS;
      if (!dentroDoPrazo) {
        throw new ConflictException({
          message: 'Só dá para contestar até 24 h depois do atendimento.',
          codigo: 'fora_do_prazo',
        });
      }

      // Se alguém já reportou de novo o mesmo tipo, aquela fica valendo: só registra a contestação.
      const outraAberta = await tx.necessidade.count({
        where: { casinhaId: n.casinhaId, tipo: n.tipo, status: 'aberta' },
      });
      if (!outraAberta) {
        await tx.necessidade.update({
          where: { id: necessidadeId },
          data: {
            status: 'aberta',
            atendidaPorId: null,
            atendidaEm: null,
            expiraEm: prazoExpiracao(n.tipo, agora),
          },
        });
      }
      await this.registrar(tx, {
        id: dto.atividadeId,
        casinhaId: n.casinhaId,
        necessidadeId,
        tipo: 'contestacao',
        usuarioId: perfil.id,
        observacao: dto.observacao,
        criadaEm: agora,
      });
      // Contestar não é "passar pela casinha": não mexe na última atividade.
      const status = await this.status.recalcular(tx, n.casinhaId, agora);
      return { resultado: 'ok', necessidadeId, status };
    });
  }

  /** "Passei aqui, tudo ok" (RF03.3). */
  checkIn(perfil: Perfil, casinhaId: string, dto: AcaoDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.travarCasinha(tx, perfil, casinhaId);
      if (await this.atividadeRegistrada(tx, perfil, dto.atividadeId)) {
        return this.resposta(tx, casinhaId, 'ok', null);
      }
      const agora = this.relogio.agora();
      await this.limites.consumir(tx, perfil.id, 'contribuicoes', agora);
      await this.registrar(tx, {
        id: dto.atividadeId,
        casinhaId,
        tipo: 'check_in',
        usuarioId: perfil.id,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto, agora),
        validadoLocal: await this.localizacao.estaPerto(casinhaId, posicao),
      });
      return this.concluir(tx, casinhaId, agora, 'ok', null);
    });
  }

  // ─── Peças comuns ──────────────────────────────────────────────────────────

  /** Ações sobre uma necessidade: acha a casinha, trava, trata repetição e relê a necessidade. */
  private async naNecessidade(
    perfil: Perfil,
    necessidadeId: string,
    atividadeId: string,
    acao: (tx: Tx, necessidade: Necessidade) => Promise<ResultadoAcao>,
  ): Promise<ResultadoAcao> {
    const alvo = await this.prisma.necessidade.findUnique({
      where: { id: necessidadeId },
      select: { casinhaId: true },
    });
    if (!alvo) throw new NotFoundException('Pedido não encontrado');

    return this.prisma.$transaction(async (tx) => {
      await this.travarCasinha(tx, perfil, alvo.casinhaId);
      if (await this.atividadeRegistrada(tx, perfil, atividadeId)) {
        return this.resposta(tx, alvo.casinhaId, 'ok', necessidadeId);
      }
      // Relida depois da trava: é o estado que vale.
      const necessidade = await tx.necessidade.findUniqueOrThrow({ where: { id: necessidadeId } });
      return acao(tx, necessidade);
    });
  }

  /**
   * Trava a casinha até o fim da transação e confere se o perfil pode agir nela: não pode
   * estar desativada; ocultada por denúncia, só moderador, criador e adotantes.
   */
  private async travarCasinha(tx: Tx, perfil: Perfil, casinhaId: string) {
    const [casinha] = await tx.$queryRaw<
      { situacao: string; moderacao: string; criada_por: string | null }[]
    >`SELECT situacao, moderacao, criada_por FROM casinhas WHERE id = ${casinhaId}::uuid FOR UPDATE`;
    if (!casinha) throw new NotFoundException('Casinha não encontrada');

    const moderador = ORDEM_NIVEL[perfil.nivel] >= ORDEM_NIVEL.moderador;
    if (casinha.situacao === 'inativa' && !moderador) {
      throw new ConflictException({
        message: 'Esta casinha foi desativada.',
        codigo: 'casinha_inativa',
      });
    }
    if (casinha.moderacao !== 'visivel' && !moderador && casinha.criada_por !== perfil.id) {
      const adotante = await tx.adocao.count({
        where: { casinhaId, usuarioId: perfil.id, ativa: true },
      });
      if (!adotante) throw new NotFoundException('Casinha não encontrada');
    }
  }

  /** A atividade com este id já existe? (reenvio da fila do celular). */
  private async atividadeRegistrada(tx: Tx, perfil: Perfil, id: string) {
    const atividade = await tx.atividade.findUnique({
      where: { id },
      select: { usuarioId: true, necessidadeId: true },
    });
    if (atividade && atividade.usuarioId !== perfil.id) {
      throw new ConflictException({ message: 'Id já usado', codigo: 'id_em_uso' });
    }
    return atividade;
  }

  private registrar(
    tx: Tx,
    dados: {
      id: string;
      casinhaId: string;
      necessidadeId?: string;
      tipo: TipoAtividade;
      usuarioId: string;
      observacao?: string;
      criadaEm: Date;
      criadaNoCelularEm?: Date;
      validadoLocal?: boolean | null;
    },
  ) {
    return tx.atividade.create({ data: dados });
  }

  /** Fecha uma ação que conta como "alguém passou pela casinha" (RN01: última atividade). */
  private async concluir(
    tx: Tx,
    casinhaId: string,
    agora: Date,
    resultado: Resultado,
    necessidadeId: string | null,
  ): Promise<ResultadoAcao> {
    await tx.casinha.update({ where: { id: casinhaId }, data: { ultimaAtividadeEm: agora } });
    const status = await this.status.recalcular(tx, casinhaId, agora);
    return { resultado, necessidadeId, status };
  }

  private async resposta(
    tx: Tx,
    casinhaId: string,
    resultado: Resultado,
    necessidadeId: string | null,
  ): Promise<ResultadoAcao> {
    const { status } = await tx.casinha.findUniqueOrThrow({
      where: { id: casinhaId },
      select: { status: true },
    });
    return { resultado, necessidadeId, status };
  }
}

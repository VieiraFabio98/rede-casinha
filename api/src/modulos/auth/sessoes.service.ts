import { randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { PayloadAcesso } from '../../comum/auth/tipos.js';
import type { Ambiente } from '../../config/ambiente.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { sha256 } from './cripto.js';

export interface Tokens {
  acesso: string;
  acessoExpiraEm: Date;
  refresh: string;
  refreshExpiraEm: Date;
}

const SESSAO_INVALIDA = 'Sessão expirada. Entre novamente.';

/** Reuso de refresh token detectado dentro da transação de rotação. */
class ReusoDeRefresh extends Error {}

/**
 * Sessões: JWT de acesso curto + refresh token opaco, rotativo, guardado só como hash.
 * Reusar um refresh já trocado (sinal de roubo) revoga todas as sessões do usuário.
 */
@Injectable()
export class SessoesService {
  private readonly logger = new Logger(SessoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Ambiente, true>,
  ) {}

  async emitir(usuarioId: string): Promise<Tokens> {
    const { refresh, refreshExpiraEm, refreshHash } = this.novoRefresh();
    await this.prisma.sessao.create({
      data: { usuarioId, refreshHash, expiraEm: refreshExpiraEm },
    });
    return { ...(await this.novoAcesso(usuarioId)), refresh, refreshExpiraEm };
  }

  async renovar(refresh: string): Promise<{ usuarioId: string; tokens: Tokens }> {
    const sessao = await this.prisma.sessao.findUnique({ where: { refreshHash: sha256(refresh) } });
    if (!sessao) throw new UnauthorizedException(SESSAO_INVALIDA);

    if (sessao.revogadaEm || sessao.substituidaPor) {
      await this.revogarReuso(sessao.usuarioId);
      throw new UnauthorizedException(SESSAO_INVALIDA);
    }
    if (sessao.expiraEm <= new Date()) throw new UnauthorizedException(SESSAO_INVALIDA);

    const novo = this.novoRefresh();
    try {
      await this.prisma.$transaction(async (tx) => {
        const nova = await tx.sessao.create({
          data: {
            usuarioId: sessao.usuarioId,
            refreshHash: novo.refreshHash,
            expiraEm: novo.refreshExpiraEm,
          },
        });
        // Condicional: se outra requisição trocou este refresh ao mesmo tempo, é reuso.
        const { count } = await tx.sessao.updateMany({
          where: { id: sessao.id, substituidaPor: null, revogadaEm: null },
          data: { substituidaPor: nova.id, revogadaEm: new Date() },
        });
        if (count === 0) throw new ReusoDeRefresh();
      });
    } catch (erro) {
      if (!(erro instanceof ReusoDeRefresh)) throw erro;
      await this.revogarReuso(sessao.usuarioId);
      throw new UnauthorizedException(SESSAO_INVALIDA);
    }

    const acesso = await this.novoAcesso(sessao.usuarioId);
    return {
      usuarioId: sessao.usuarioId,
      tokens: { ...acesso, refresh: novo.refresh, refreshExpiraEm: novo.refreshExpiraEm },
    };
  }

  /** Logout: revoga só a sessão deste refresh token (idempotente). */
  async revogar(refresh: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { refreshHash: sha256(refresh), revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  async revogarTodas(usuarioId: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { usuarioId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  private async revogarReuso(usuarioId: string) {
    this.logger.warn(
      `Reuso de refresh token detectado; revogando as sessões do usuário ${usuarioId}`,
    );
    await this.revogarTodas(usuarioId);
  }

  private async novoAcesso(usuarioId: string) {
    const minutos = this.config.get('ACESSO_MINUTOS', { infer: true });
    const payload: PayloadAcesso = { sub: usuarioId };
    const acesso = await this.jwt.signAsync(payload, { expiresIn: minutos * 60 });
    return { acesso, acessoExpiraEm: new Date(Date.now() + minutos * 60_000) };
  }

  private novoRefresh() {
    const refresh = randomBytes(32).toString('base64url');
    const dias = this.config.get('REFRESH_DIAS', { infer: true });
    return {
      refresh,
      refreshHash: sha256(refresh),
      refreshExpiraEm: new Date(Date.now() + dias * 24 * 60 * 60_000),
    };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import { UnauthorizedError } from '../../../../shared/errors/index.js';
import {
  EMISSOR_DE_TOKENS,
  type EmissorDeTokens,
} from '../../domain/providers/emissor-de-tokens.provider.js';
import {
  SESSOES_REPOSITORY,
  type SessoesRepository,
} from '../../domain/repositories/sessoes.repository.js';
import type { TokensResposta } from '../dto/auth.dto.js';
import { AberturaDeSessao } from './abertura-de-sessao.js';

const SESSAO_INVALIDA = 'Sessão expirada. Entre novamente.';

/** Reuso detectado dentro da transação de rotação: desfaz a sessão nova. */
class ReusoDeRefresh extends Error {}

/**
 * Troca o refresh token por um novo par (rotativo). Reusar um refresh já trocado
 * (sinal de roubo) revoga todas as sessões do usuário.
 */
@Injectable()
export class RenovarSessaoUseCase {
  private readonly logger = new Logger(RenovarSessaoUseCase.name);

  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(SESSOES_REPOSITORY) private readonly sessoes: SessoesRepository,
    @Inject(EMISSOR_DE_TOKENS) private readonly emissor: EmissorDeTokens,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    private readonly abertura: AberturaDeSessao,
  ) {}

  async executar(refresh: string): Promise<TokensResposta> {
    const agora = this.relogio.agora();
    const sessao = await this.sessoes.buscarPorRefresh(this.emissor.hashDoRefresh(refresh));
    if (!sessao) throw new UnauthorizedError(SESSAO_INVALIDA);
    if (sessao.revogadaEm || sessao.substituidaPor) {
      return this.revogarPorReuso(sessao.usuarioId, agora);
    }
    if (sessao.expiraEm <= agora) throw new UnauthorizedError(SESSAO_INVALIDA);

    const novo = this.emissor.novoRefresh(agora);
    try {
      await this.transacao.executar(async () => {
        const nova = await this.sessoes.criar({
          usuarioId: sessao.usuarioId,
          refreshHash: novo.refreshHash,
          expiraEm: novo.refreshExpiraEm,
        });
        if (!(await this.sessoes.substituir(sessao.id, nova.id, agora))) {
          throw new ReusoDeRefresh();
        }
      });
    } catch (erro) {
      if (!(erro instanceof ReusoDeRefresh)) throw erro;
      return this.revogarPorReuso(sessao.usuarioId, agora);
    }

    return {
      ...(await this.emissor.acesso(sessao.usuarioId, agora)),
      refresh: novo.refresh,
      refreshExpiraEm: novo.refreshExpiraEm,
      precisaCadastro: await this.abertura.precisaCadastro(sessao.usuarioId),
    };
  }

  private async revogarPorReuso(usuarioId: string, agora: Date): Promise<never> {
    this.logger.warn(
      `Reuso de refresh token detectado; revogando as sessões do usuário ${usuarioId}`,
    );
    await this.sessoes.revogarTodas(usuarioId, agora);
    throw new UnauthorizedError(SESSAO_INVALIDA);
  }
}

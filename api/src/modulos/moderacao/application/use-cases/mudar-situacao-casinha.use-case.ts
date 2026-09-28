import { Inject, Injectable } from '@nestjs/common';

import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { NotFoundError } from '../../../../shared/errors/index.js';
import {
  AUDITORIA_REPOSITORY,
  type AuditoriaRepository,
} from '../../domain/repositories/auditoria.repository.js';
import {
  CASINHAS_MODERACAO_REPOSITORY,
  type CasinhasModeracaoRepository,
} from '../../domain/repositories/casinhas-moderacao.repository.js';
import type { FeitoResposta } from '../dto/moderacao.dto.js';

abstract class MudarSituacaoCasinha {
  protected abstract readonly situacao: 'ativa' | 'inativa';
  protected abstract readonly acao: string;

  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(CASINHAS_MODERACAO_REPOSITORY) private readonly casinhas: CasinhasModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
  ) {}

  executar(moderador: UsuarioLogado, casinhaId: string, motivo: string): Promise<FeitoResposta> {
    return this.transacao.executar(async () => {
      if (!(await this.casinhas.travar(casinhaId))) {
        throw new NotFoundError('Casinha não encontrada');
      }
      await this.casinhas.mudarSituacao(casinhaId, this.situacao);
      await this.auditoria.registrar({
        moderadorId: moderador.id,
        acao: this.acao,
        alvoTipo: 'casinha',
        alvoId: casinhaId,
        motivo,
      });
      return { resultado: 'ok' };
    });
  }
}

/** Tira do mapa (casinha removida ou destruída). */
@Injectable()
export class DesativarCasinhaUseCase extends MudarSituacaoCasinha {
  protected readonly situacao = 'inativa';
  protected readonly acao = 'desativar';
}

/** Aprova casinha em revisão, reativa, ou mantém depois de um pedido de desativação. */
@Injectable()
export class AtivarCasinhaUseCase extends MudarSituacaoCasinha {
  protected readonly situacao = 'ativa';
  protected readonly acao = 'ativar';
}

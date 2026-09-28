import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ACESSO_CASINHA, type AcessoCasinha } from '../../domain/providers/portas.js';
import {
  ADOCOES_REPOSITORY,
  type AdocoesRepository,
} from '../../domain/repositories/adocoes.repository.js';
import type { ResultadoAdocao } from '../dto/adocoes.dto.js';

/** RF04.4. Sem adoção ativa, não faz nada (idempotente). */
@Injectable()
export class DeixarDeAdotarUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(ADOCOES_REPOSITORY) private readonly adocoes: AdocoesRepository,
    @Inject(ACESSO_CASINHA) private readonly acesso: AcessoCasinha,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, casinhaId: string): Promise<ResultadoAdocao> {
    return this.transacao.executar(async () => {
      await this.acesso.travarParaAcao(usuario, casinhaId);
      await this.adocoes.encerrar(casinhaId, usuario.id, this.relogio.agora());
      return { resultado: 'ok' };
    });
  }
}

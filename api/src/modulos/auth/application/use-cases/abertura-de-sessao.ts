import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import {
  EMISSOR_DE_TOKENS,
  type EmissorDeTokens,
} from '../../domain/providers/emissor-de-tokens.provider.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import {
  SESSOES_REPOSITORY,
  type SessoesRepository,
} from '../../domain/repositories/sessoes.repository.js';
import type { TokensResposta } from '../dto/auth.dto.js';

/** Abre uma sessão para a conta que acabou de entrar (por qualquer meio). */
@Injectable()
export class AberturaDeSessao {
  constructor(
    @Inject(SESSOES_REPOSITORY) private readonly sessoes: SessoesRepository,
    @Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository,
    @Inject(EMISSOR_DE_TOKENS) private readonly emissor: EmissorDeTokens,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async abrir(usuarioId: string): Promise<TokensResposta> {
    const agora = this.relogio.agora();
    const { refresh, refreshHash, refreshExpiraEm } = this.emissor.novoRefresh(agora);
    await this.sessoes.criar({ usuarioId, refreshHash, expiraEm: refreshExpiraEm });
    const acesso = await this.emissor.acesso(usuarioId, agora);
    return {
      ...acesso,
      refresh,
      refreshExpiraEm,
      precisaCadastro: await this.precisaCadastro(usuarioId),
    };
  }

  /** `true` enquanto o usuário não concluir o cadastro (apelido, 18 anos, termos). */
  async precisaCadastro(usuarioId: string): Promise<boolean> {
    return !(await this.contas.temPerfil(usuarioId));
  }
}

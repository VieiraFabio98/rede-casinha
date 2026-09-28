import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import {
  EMISSOR_DE_TOKENS,
  type EmissorDeTokens,
} from '../../domain/providers/emissor-de-tokens.provider.js';
import {
  SESSOES_REPOSITORY,
  type SessoesRepository,
} from '../../domain/repositories/sessoes.repository.js';

/** Logout: revoga só a sessão deste refresh token (idempotente). */
@Injectable()
export class SairUseCase {
  constructor(
    @Inject(SESSOES_REPOSITORY) private readonly sessoes: SessoesRepository,
    @Inject(EMISSOR_DE_TOKENS) private readonly emissor: EmissorDeTokens,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(refresh: string): Promise<void> {
    return this.sessoes.revogarPorRefresh(
      this.emissor.hashDoRefresh(refresh),
      this.relogio.agora(),
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';

import {
  BANCO_DE_DADOS,
  type BancoDeDados,
} from '../../domain/providers/banco-de-dados.provider.js';
import type { SaudeResposta } from '../dto/saude.dto.js';

@Injectable()
export class VerificarSaudeUseCase {
  constructor(@Inject(BANCO_DE_DADOS) private readonly banco: BancoDeDados) {}

  async executar(): Promise<SaudeResposta> {
    const ok = await this.banco.responde();
    return { ok, banco: ok ? 'ok' : 'erro' };
  }
}

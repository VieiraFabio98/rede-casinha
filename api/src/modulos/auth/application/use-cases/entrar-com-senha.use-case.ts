import { Inject, Injectable } from '@nestjs/common';

import { UnauthorizedError } from '../../../../shared/errors/index.js';
import { SENHAS, type Senhas } from '../../domain/providers/senhas.provider.js';
import { normalizarEmail } from '../../domain/regras.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import type { TokensResposta } from '../dto/auth.dto.js';
import { AberturaDeSessao } from './abertura-de-sessao.js';

/** Só a conta de demonstração do revisor da loja tem senha (scripts/criar-conta-revisor.ts). */
@Injectable()
export class EntrarComSenhaUseCase {
  constructor(
    @Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository,
    @Inject(SENHAS) private readonly senhas: Senhas,
    private readonly sessao: AberturaDeSessao,
  ) {}

  async executar(emailBruto: string, senha: string): Promise<TokensResposta> {
    const conta = await this.contas.buscarPorEmail(normalizarEmail(emailBruto));
    const senhaConfere = await this.senhas.confere(conta?.senhaHash ?? null, senha);
    if (!conta || !senhaConfere) throw new UnauthorizedError('E-mail ou senha incorretos.');
    return this.sessao.abrir(conta.id);
  }
}

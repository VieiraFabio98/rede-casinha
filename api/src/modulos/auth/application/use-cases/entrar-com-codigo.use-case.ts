import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { UnauthorizedError } from '../../../../shared/errors/index.js';
import {
  CODIGOS_DE_LOGIN,
  type CodigosDeLogin,
} from '../../domain/providers/codigos-de-login.provider.js';
import { MAX_TENTATIVAS_CODIGO, normalizarEmail } from '../../domain/regras.js';
import {
  CODIGOS_REPOSITORY,
  type CodigosRepository,
} from '../../domain/repositories/codigos.repository.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import type { TokensResposta } from '../dto/auth.dto.js';
import { AberturaDeSessao } from './abertura-de-sessao.js';

const CODIGO_INVALIDO = 'Código inválido ou expirado. Peça um novo código.';

/** Entra com o código recebido por e-mail; cria a conta no primeiro acesso. */
@Injectable()
export class EntrarComCodigoUseCase {
  constructor(
    @Inject(CODIGOS_REPOSITORY) private readonly codigos: CodigosRepository,
    @Inject(CODIGOS_DE_LOGIN) private readonly codigosDeLogin: CodigosDeLogin,
    @Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    private readonly sessao: AberturaDeSessao,
  ) {}

  async executar(emailBruto: string, codigo: string): Promise<TokensResposta> {
    const email = normalizarEmail(emailBruto);
    const agora = this.relogio.agora();
    await this.consumirCodigo(email, codigo, agora);

    const conta = await this.contas.buscarOuCriarPorEmail(email, agora);
    if (!conta.emailVerificadoEm) await this.contas.marcarEmailVerificado(conta.id, agora);
    return this.sessao.abrir(conta.id);
  }

  /** Errado, expirado, já usado ou com tentativas esgotadas: 401. */
  private async consumirCodigo(email: string, codigo: string, agora: Date) {
    const pendente = await this.codigos.pendenteMaisRecente(email, agora);
    if (!pendente || pendente.tentativas >= MAX_TENTATIVAS_CODIGO) {
      throw new UnauthorizedError(CODIGO_INVALIDO);
    }
    if (!this.codigosDeLogin.confere(email, codigo, pendente.codigoHash)) {
      await this.codigos.registrarTentativa(pendente.id);
      throw new UnauthorizedError(CODIGO_INVALIDO);
    }
    // Duas verificações simultâneas não podem usar o mesmo código.
    if (!(await this.codigos.marcarUsado(pendente.id, agora))) {
      throw new UnauthorizedError(CODIGO_INVALIDO);
    }
  }
}

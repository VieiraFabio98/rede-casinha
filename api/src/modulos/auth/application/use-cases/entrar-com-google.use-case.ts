import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { UnauthorizedError } from '../../../../shared/errors/index.js';
import {
  VERIFICADOR_GOOGLE,
  type VerificadorGoogle,
} from '../../domain/providers/verificador-google.provider.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import type { TokensResposta } from '../dto/auth.dto.js';
import { AberturaDeSessao } from './abertura-de-sessao.js';

/** Entra com o ID token do Google Sign-In; cria a conta no primeiro acesso. */
@Injectable()
export class EntrarComGoogleUseCase {
  constructor(
    @Inject(VERIFICADOR_GOOGLE) private readonly google: VerificadorGoogle,
    @Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    private readonly sessao: AberturaDeSessao,
  ) {}

  async executar(idToken: string): Promise<TokensResposta> {
    const { sub, email } = await this.google.verificar(idToken);
    const agora = this.relogio.agora();

    let conta = await this.contas.buscarPorGoogle(sub);
    if (!conta) {
      const mesmoEmail = await this.contas.buscarPorEmail(email);
      if (mesmoEmail?.googleSub && mesmoEmail.googleSub !== sub) {
        // O e-mail pertence a outra conta Google: não vincula automaticamente.
        throw new UnauthorizedError('Este e-mail já está ligado a outra conta Google.');
      }
      conta = mesmoEmail
        ? await this.contas.vincularGoogle(
            mesmoEmail.id,
            sub,
            mesmoEmail.emailVerificadoEm ?? agora,
          )
        : await this.contas.criar({ email, googleSub: sub, emailVerificadoEm: agora });
    }
    return this.sessao.abrir(conta.id);
  }
}

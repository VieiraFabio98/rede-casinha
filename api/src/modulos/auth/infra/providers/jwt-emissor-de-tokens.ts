import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Ambiente } from '../../../../config/ambiente.js';
import type { PayloadAcesso } from '../../../../shared/infra/auth/tipos.js';
import { minutosDepois } from '../../domain/regras.js';
import type { EmissorDeTokens } from '../../domain/providers/emissor-de-tokens.provider.js';
import { sha256 } from './cripto.js';

@Injectable()
export class JwtEmissorDeTokens implements EmissorDeTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Ambiente, true>,
  ) {}

  async acesso(usuarioId: string, agora: Date) {
    const minutos = this.config.get('ACESSO_MINUTOS', { infer: true });
    const payload: PayloadAcesso = { sub: usuarioId };
    const acesso = await this.jwt.signAsync(payload, { expiresIn: minutos * 60 });
    return { acesso, acessoExpiraEm: minutosDepois(agora, minutos) };
  }

  novoRefresh(agora: Date) {
    const refresh = randomBytes(32).toString('base64url');
    const dias = this.config.get('REFRESH_DIAS', { infer: true });
    return {
      refresh,
      refreshHash: sha256(refresh),
      refreshExpiraEm: minutosDepois(agora, dias * 24 * 60),
    };
  }

  hashDoRefresh(refresh: string) {
    return sha256(refresh);
  }
}

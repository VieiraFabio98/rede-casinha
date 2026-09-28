import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import type { Ambiente } from '../../../../config/ambiente.js';
import { UnauthorizedError } from '../../../../shared/errors/index.js';
import type {
  IdentidadeGoogle,
  VerificadorGoogle,
} from '../../domain/providers/verificador-google.provider.js';

const LOGIN_INVALIDO = 'Não foi possível entrar com o Google. Tente de novo.';

/** Valida o ID token que o app recebe do Google Sign-In (audience = cliente OAuth Web). */
@Injectable()
export class VerificadorGoogleAdapter implements VerificadorGoogle {
  private readonly cliente = new OAuth2Client();
  private readonly audience: string;

  constructor(config: ConfigService<Ambiente, true>) {
    this.audience = config.get('GOOGLE_WEB_CLIENT_ID', { infer: true });
  }

  async verificar(idToken: string): Promise<IdentidadeGoogle> {
    let payload;
    try {
      const ticket = await this.cliente.verifyIdToken({ idToken, audience: this.audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedError(LOGIN_INVALIDO);
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedError(LOGIN_INVALIDO);
    }
    return { sub: payload.sub, email: payload.email.toLowerCase() };
  }
}

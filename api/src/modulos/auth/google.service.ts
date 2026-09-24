import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import type { Ambiente } from '../../config/ambiente.js';

export interface IdentidadeGoogle {
  sub: string;
  email: string;
}

const LOGIN_INVALIDO = 'Não foi possível entrar com o Google. Tente de novo.';

/** Valida o ID token que o app recebe do Google Sign-In (audience = cliente OAuth Web). */
@Injectable()
export class GoogleService {
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
      throw new UnauthorizedException(LOGIN_INVALIDO);
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException(LOGIN_INVALIDO);
    }
    return { sub: payload.sub, email: payload.email.toLowerCase() };
  }
}

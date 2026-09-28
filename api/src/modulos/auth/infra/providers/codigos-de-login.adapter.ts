import { randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Ambiente } from '../../../../config/ambiente.js';
import { EmailService } from '../../../../shared/infra/email/email.service.js';
import { emailCodigoLogin } from '../../../../shared/infra/email/modelos.js';
import type {
  CodigosDeLogin,
  EnvioDeCodigo,
} from '../../domain/providers/codigos-de-login.provider.js';
import { hashesIguais, hmac } from './cripto.js';

@Injectable()
export class HmacCodigosDeLogin implements CodigosDeLogin {
  private readonly segredo: string;

  constructor(config: ConfigService<Ambiente, true>) {
    this.segredo = config.get('HMAC_SEGREDO', { infer: true });
  }

  gerar() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hash(email: string, codigo: string) {
    return hmac(this.segredo, `${email}:${codigo}`);
  }

  confere(email: string, codigo: string, hash: string) {
    return hashesIguais(this.hash(email, codigo), hash);
  }
}

@Injectable()
export class EnvioDeCodigoPorEmail implements EnvioDeCodigo {
  constructor(private readonly email: EmailService) {}

  enviar(email: string, codigo: string, validadeMinutos: number) {
    return this.email.enviar(emailCodigoLogin(email, codigo, validadeMinutos));
  }
}

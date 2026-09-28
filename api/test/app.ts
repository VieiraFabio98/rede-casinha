import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { Relogio } from '../src/shared/infra/relogio.js';
import { configurarApp } from '../src/configurar-app.js';
import { EmailMemoria, EmailService } from '../src/shared/infra/email/email.service.js';
import {
  type IdentidadeGoogle,
  VERIFICADOR_GOOGLE,
  type VerificadorGoogle,
} from '../src/modulos/auth/domain/providers/verificador-google.provider.js';
import { UnauthorizedError } from '../src/shared/errors/index.js';

/**
 * Google simulado: o "ID token" é um JSON com a identidade que o teste quer.
 * Ex.: tokenGoogle({ sub: '123', email: 'a@b.test' }). Tokens inválidos lançam 401 como o real.
 */
export function tokenGoogle(identidade: IdentidadeGoogle & { emailVerificado?: boolean }): string {
  return JSON.stringify(identidade);
}

class GoogleSimulado implements VerificadorGoogle {
  async verificar(idToken: string): Promise<IdentidadeGoogle> {
    try {
      const { sub, email, emailVerificado = true } = JSON.parse(idToken);
      if (!sub || !email || !emailVerificado) throw new Error('inválido');
      return { sub, email: String(email).toLowerCase() };
    } catch {
      throw new UnauthorizedError('Não foi possível entrar com o Google. Tente de novo.');
    }
  }
}

/** Relógio que o teste controla: começa na hora real e só anda com `avancar`. */
export class RelogioDeTeste extends Relogio {
  private atual = new Date();

  agora(): Date {
    return new Date(this.atual);
  }

  avancar(ms: number) {
    this.atual = new Date(this.atual.getTime() + ms);
  }
}

export async function criarAppDeTeste(
  opcoes: { relogio?: Relogio } = {},
): Promise<{ app: INestApplication; emails: EmailMemoria }> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(VERIFICADOR_GOOGLE)
    .useValue(new GoogleSimulado())
    .overrideProvider(Relogio)
    .useValue(opcoes.relogio ?? new Relogio())
    .compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.init();
  return { app, emails: app.get(EmailService) as EmailMemoria };
}

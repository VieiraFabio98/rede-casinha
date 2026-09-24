import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { EmailMemoria, EmailService } from '../src/infra/email/email.service.js';
import { GoogleService, type IdentidadeGoogle } from '../src/modulos/auth/google.service.js';

/**
 * Google simulado: o "ID token" é um JSON com a identidade que o teste quer.
 * Ex.: tokenGoogle({ sub: '123', email: 'a@b.test' }). Tokens inválidos lançam 401 como o real.
 */
export function tokenGoogle(identidade: IdentidadeGoogle & { emailVerificado?: boolean }): string {
  return JSON.stringify(identidade);
}

class GoogleSimulado {
  async verificar(idToken: string): Promise<IdentidadeGoogle> {
    const { UnauthorizedException } = await import('@nestjs/common');
    try {
      const { sub, email, emailVerificado = true } = JSON.parse(idToken);
      if (!sub || !email || !emailVerificado) throw new Error('inválido');
      return { sub, email: String(email).toLowerCase() };
    } catch {
      throw new UnauthorizedException('Não foi possível entrar com o Google. Tente de novo.');
    }
  }
}

export async function criarAppDeTeste(): Promise<{ app: INestApplication; emails: EmailMemoria }> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GoogleService)
    .useValue(new GoogleSimulado())
    .compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.init();
  return { app, emails: app.get(EmailService) as EmailMemoria };
}

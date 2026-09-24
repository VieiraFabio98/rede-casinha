import { randomInt } from 'node:crypto';

import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Ambiente } from '../../config/ambiente.js';
import { EmailService } from '../../infra/email/email.service.js';
import { emailCodigoLogin } from '../../infra/email/modelos.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { hashesIguais, hmac } from './cripto.js';

export const VALIDADE_CODIGO_MIN = 10;
export const MAX_TENTATIVAS_CODIGO = 5;
const INTERVALO_MINIMO_MS = 60_000;
const MAX_CODIGOS_POR_HORA = 5;
const CODIGO_INVALIDO = 'Código inválido ou expirado. Peça um novo código.';

/** Login sem senha: código de 6 dígitos por e-mail, guardado só como HMAC. */
@Injectable()
export class CodigoEmailService {
  private readonly segredo: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    config: ConfigService<Ambiente, true>,
  ) {
    this.segredo = config.get('HMAC_SEGREDO', { infer: true });
  }

  /** `email` já normalizado. Responde igual exista ou não uma conta com esse e-mail. */
  async solicitar(email: string): Promise<void> {
    const agora = Date.now();
    const ultimo = await this.prisma.codigoEmail.findFirst({
      where: { email },
      orderBy: { criadoEm: 'desc' },
    });
    if (ultimo && agora - ultimo.criadoEm.getTime() < INTERVALO_MINIMO_MS) {
      throw new HttpException(
        'Aguarde 1 minuto para pedir outro código.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const naUltimaHora = await this.prisma.codigoEmail.count({
      where: { email, criadoEm: { gt: new Date(agora - 60 * 60_000) } },
    });
    if (naUltimaHora >= MAX_CODIGOS_POR_HORA) {
      throw new HttpException(
        'Muitos códigos pedidos. Tente de novo mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      // Só o código mais recente vale.
      this.prisma.codigoEmail.updateMany({
        where: { email, usadoEm: null, expiraEm: { gt: new Date(agora) } },
        data: { expiraEm: new Date(agora) },
      }),
      this.prisma.codigoEmail.create({
        data: {
          email,
          codigoHash: this.hash(email, codigo),
          expiraEm: new Date(agora + VALIDADE_CODIGO_MIN * 60_000),
        },
      }),
    ]);
    await this.email.enviar(emailCodigoLogin(email, codigo, VALIDADE_CODIGO_MIN));
  }

  /** Consome o código. Lança 401 se estiver errado, expirado, já usado ou com tentativas esgotadas. */
  async verificar(email: string, codigo: string): Promise<void> {
    const registro = await this.prisma.codigoEmail.findFirst({
      where: { email, usadoEm: null, expiraEm: { gt: new Date() } },
      orderBy: { criadoEm: 'desc' },
    });
    if (!registro || registro.tentativas >= MAX_TENTATIVAS_CODIGO) {
      throw new UnauthorizedException(CODIGO_INVALIDO);
    }

    if (!hashesIguais(this.hash(email, codigo), registro.codigoHash)) {
      await this.prisma.codigoEmail.update({
        where: { id: registro.id },
        data: { tentativas: { increment: 1 } },
      });
      throw new UnauthorizedException(CODIGO_INVALIDO);
    }

    // Condicional: duas verificações simultâneas não podem usar o mesmo código.
    const { count } = await this.prisma.codigoEmail.updateMany({
      where: { id: registro.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    if (count === 0) throw new UnauthorizedException(CODIGO_INVALIDO);
  }

  private hash(email: string, codigo: string): string {
    return hmac(this.segredo, `${email}:${codigo}`);
  }
}

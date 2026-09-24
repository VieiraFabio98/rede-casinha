import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

import type { Usuario } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { TokensResposta } from './auth.dto.js';
import { CodigoEmailService } from './codigo-email.service.js';
import { normalizarEmail } from './cripto.js';
import { GoogleService } from './google.service.js';
import { SessoesService } from './sessoes.service.js';

@Injectable()
export class AuthService implements OnModuleInit {
  /** Hash de uma senha qualquer: verificado quando o e-mail não existe, para igualar o tempo de resposta. */
  private hashFicticio: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessoesService,
    private readonly codigos: CodigoEmailService,
    private readonly google: GoogleService,
  ) {}

  async onModuleInit() {
    this.hashFicticio = await hash('senha-ficticia-para-igualar-o-tempo');
  }

  async entrarComGoogle(idToken: string): Promise<TokensResposta> {
    const { sub, email } = await this.google.verificar(idToken);

    let usuario = await this.prisma.usuario.findUnique({ where: { googleSub: sub } });
    if (!usuario) {
      const mesmoEmail = await this.prisma.usuario.findUnique({ where: { email } });
      if (mesmoEmail?.googleSub && mesmoEmail.googleSub !== sub) {
        // O e-mail pertence a outra conta Google: não vincula automaticamente.
        throw new UnauthorizedException('Este e-mail já está ligado a outra conta Google.');
      }
      usuario = mesmoEmail
        ? await this.prisma.usuario.update({
            where: { id: mesmoEmail.id },
            data: { googleSub: sub, emailVerificadoEm: mesmoEmail.emailVerificadoEm ?? new Date() },
          })
        : await this.prisma.usuario.create({
            data: { email, googleSub: sub, emailVerificadoEm: new Date() },
          });
    }
    return this.responder(usuario);
  }

  async pedirCodigo(email: string): Promise<void> {
    await this.codigos.solicitar(normalizarEmail(email));
  }

  async entrarComCodigo(emailBruto: string, codigo: string): Promise<TokensResposta> {
    const email = normalizarEmail(emailBruto);
    await this.codigos.verificar(email, codigo);
    const usuario = await this.prisma.usuario.upsert({
      where: { email },
      create: { email, emailVerificadoEm: new Date() },
      update: {},
    });
    if (!usuario.emailVerificadoEm) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { emailVerificadoEm: new Date() },
      });
    }
    return this.responder(usuario);
  }

  /** Só a conta de demonstração do revisor da loja tem senha (scripts/criar-conta-revisor.ts). */
  async entrarComSenha(emailBruto: string, senha: string): Promise<TokensResposta> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: normalizarEmail(emailBruto) },
    });
    const senhaConfere = await verify(usuario?.senhaHash ?? this.hashFicticio, senha);
    if (!usuario?.senhaHash || !senhaConfere) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }
    return this.responder(usuario);
  }

  async renovar(refresh: string): Promise<TokensResposta> {
    const { usuarioId, tokens } = await this.sessoes.renovar(refresh);
    return { ...tokens, precisaCadastro: !(await this.temPerfil(usuarioId)) };
  }

  async sair(refresh: string): Promise<void> {
    await this.sessoes.revogar(refresh);
  }

  private async responder(usuario: Usuario): Promise<TokensResposta> {
    const tokens = await this.sessoes.emitir(usuario.id);
    return { ...tokens, precisaCadastro: !(await this.temPerfil(usuario.id)) };
  }

  private async temPerfil(usuarioId: string): Promise<boolean> {
    return (await this.prisma.perfil.count({ where: { id: usuarioId } })) > 0;
  }
}

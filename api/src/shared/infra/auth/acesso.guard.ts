import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { NivelAcesso } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CHAVE_NIVEL, CHAVE_PUBLICO } from './decoradores.js';
import { ORDEM_NIVEL, type PayloadAcesso, type RequisicaoAutenticada } from './tipos.js';

/**
 * Guard global: toda rota exige token de acesso, exceto as marcadas com `@Publico()`.
 * Nas rotas com `@Nivel()`, também exige cadastro concluído, conta não bloqueada e nível mínimo.
 * Autenticação e nível ficam no mesmo guard para a ordem de execução ser sempre a mesma.
 */
@Injectable()
export class AcessoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const alvos = [contexto.getHandler(), contexto.getClass()];
    const publica = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, alvos) ?? false;
    const nivelMinimo = this.reflector.getAllAndOverride<NivelAcesso | undefined>(
      CHAVE_NIVEL,
      alvos,
    );
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();

    const token = this.extrairToken(requisicao);
    if (token) {
      const payload = await this.verificar(token);
      if (payload) {
        requisicao.usuario = { id: payload.sub };
      } else if (!publica) {
        throw new UnauthorizedException('Sessão expirada ou inválida');
      }
    }

    if (publica) return true;
    if (!requisicao.usuario) throw new UnauthorizedException('Entre na sua conta para continuar');
    if (nivelMinimo) await this.exigirNivel(requisicao, nivelMinimo);
    return true;
  }

  private extrairToken(requisicao: RequisicaoAutenticada): string | undefined {
    const [tipo, token] = requisicao.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' && token ? token : undefined;
  }

  private async verificar(token: string): Promise<PayloadAcesso | undefined> {
    try {
      const payload = await this.jwt.verifyAsync<PayloadAcesso>(token);
      return typeof payload.sub === 'string' ? payload : undefined;
    } catch {
      return undefined;
    }
  }

  private async exigirNivel(requisicao: RequisicaoAutenticada, nivelMinimo: NivelAcesso) {
    const perfil = await this.prisma.perfil.findUnique({ where: { id: requisicao.usuario!.id } });
    if (!perfil) {
      throw new ForbiddenException({
        message: 'Conclua seu cadastro para continuar',
        codigo: 'cadastro_pendente',
      });
    }
    if (perfil.bloqueadoAte && perfil.bloqueadoAte > new Date()) {
      throw new ForbiddenException({
        message: 'Sua conta está bloqueada temporariamente',
        codigo: 'conta_bloqueada',
      });
    }
    if (ORDEM_NIVEL[perfil.nivel] < ORDEM_NIVEL[nivelMinimo]) {
      throw new ForbiddenException({
        message: 'Você não tem permissão para esta ação',
        codigo: 'nivel_insuficiente',
      });
    }
    requisicao.perfil = perfil;
  }
}

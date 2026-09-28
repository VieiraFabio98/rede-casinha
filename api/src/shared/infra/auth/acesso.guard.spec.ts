import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';

import type { NivelAcesso } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AcessoGuard } from './acesso.guard.js';
import { CHAVE_NIVEL, CHAVE_PUBLICO } from './decoradores.js';
import type { RequisicaoAutenticada } from './tipos.js';

function montar(opcoes: {
  publica?: boolean;
  nivel?: NivelAcesso;
  token?: string;
  tokenValido?: boolean;
  perfil?: { nivel: NivelAcesso; bloqueadoAte?: Date | null } | null;
}) {
  const reflector = {
    getAllAndOverride: (chave: string) =>
      chave === CHAVE_PUBLICO ? opcoes.publica : chave === CHAVE_NIVEL ? opcoes.nivel : undefined,
  } as unknown as Reflector;
  const jwt = {
    verifyAsync: async () => {
      if (!opcoes.tokenValido) throw new Error('inválido');
      return { sub: 'usuario-1' };
    },
  } as unknown as JwtService;
  const prisma = {
    perfil: {
      findUnique: async () => (opcoes.perfil ? { bloqueadoAte: null, ...opcoes.perfil } : null),
    },
  } as unknown as PrismaService;

  const requisicao = {
    headers: opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {},
  } as RequisicaoAutenticada;
  const contexto = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext;

  return { guard: new AcessoGuard(reflector, jwt, prisma), contexto, requisicao };
}

describe('AcessoGuard', () => {
  it('rota pública sem token passa como visitante', async () => {
    const { guard, contexto, requisicao } = montar({ publica: true });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(requisicao.usuario).toBeUndefined();
  });

  it('rota pública com token válido identifica o usuário', async () => {
    const { guard, contexto, requisicao } = montar({
      publica: true,
      token: 't',
      tokenValido: true,
    });
    await guard.canActivate(contexto);
    expect(requisicao.usuario).toEqual({ id: 'usuario-1' });
  });

  it('rota pública com token inválido segue como visitante', async () => {
    const { guard, contexto } = montar({ publica: true, token: 't', tokenValido: false });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('rota protegida sem token ou com token inválido: 401', async () => {
    await expect(montar({}).guard.canActivate(montar({}).contexto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const invalido = montar({ token: 't', tokenValido: false });
    await expect(invalido.guard.canActivate(invalido.contexto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('@Nivel sem cadastro concluído: 403 cadastro_pendente', async () => {
    const { guard, contexto } = montar({
      token: 't',
      tokenValido: true,
      nivel: 'colaborador',
      perfil: null,
    });
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { codigo: 'cadastro_pendente' },
    });
  });

  it('@Nivel com conta bloqueada: 403 conta_bloqueada', async () => {
    const amanha = new Date(Date.now() + 86_400_000);
    const { guard, contexto } = montar({
      token: 't',
      tokenValido: true,
      nivel: 'colaborador',
      perfil: { nivel: 'moderador', bloqueadoAte: amanha },
    });
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { codigo: 'conta_bloqueada' },
    });
  });

  it('bloqueio vencido não impede o acesso', async () => {
    const ontem = new Date(Date.now() - 86_400_000);
    const { guard, contexto } = montar({
      token: 't',
      tokenValido: true,
      nivel: 'colaborador',
      perfil: { nivel: 'colaborador', bloqueadoAte: ontem },
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it.each([
    ['colaborador', 'verificado', false],
    ['verificado', 'verificado', true],
    ['moderador', 'verificado', true],
    ['verificado', 'moderador', false],
    ['admin', 'moderador', true],
  ] as const)('nível %s em rota @Nivel(%s): permitido = %s', async (tem, exige, permitido) => {
    const { guard, contexto, requisicao } = montar({
      token: 't',
      tokenValido: true,
      nivel: exige,
      perfil: { nivel: tem },
    });
    if (permitido) {
      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      expect(requisicao.perfil).toMatchObject({ nivel: tem });
    } else {
      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});

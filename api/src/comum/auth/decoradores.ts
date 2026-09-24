import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

import type { NivelAcesso } from '../../generated/prisma/client.js';
import type { RequisicaoAutenticada, UsuarioAutenticado } from './tipos.js';

export const CHAVE_PUBLICO = 'rota-publica';
export const CHAVE_NIVEL = 'nivel-minimo';

/** Rota aberta a visitantes. Se vier um token válido, o usuário ainda é identificado. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);

/**
 * Exige cadastro concluído, conta não bloqueada e nível mínimo.
 * `@Nivel('colaborador')` = qualquer usuário com cadastro concluído.
 */
export const Nivel = (nivel: NivelAcesso) => SetMetadata(CHAVE_NIVEL, nivel);

/** Injeta `{ id }` do usuário autenticado no parâmetro do controller. */
export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): UsuarioAutenticado | undefined =>
    contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuario,
);

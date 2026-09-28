import type { Request } from 'express';

import type { Perfil } from '../../../generated/prisma/client.js';

export { ORDEM_NIVEL } from '../../domain/usuario-logado.js';

export interface UsuarioAutenticado {
  id: string;
}

export interface PayloadAcesso {
  sub: string;
}

export interface RequisicaoAutenticada extends Request {
  usuario?: UsuarioAutenticado;
  /** Preenchido pelo guard nas rotas com `@Nivel()`. */
  perfil?: Perfil;
}

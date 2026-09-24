import type { Request } from 'express';

import type { NivelAcesso, Perfil } from '../../generated/prisma/client.js';

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

/** Ordem dos níveis: cada um inclui os anteriores. */
export const ORDEM_NIVEL: Record<NivelAcesso, number> = {
  colaborador: 0,
  verificado: 1,
  moderador: 2,
  admin: 3,
};

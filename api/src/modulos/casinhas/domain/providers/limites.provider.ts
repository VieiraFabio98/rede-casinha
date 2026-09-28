import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';

/** Limites diários do cadastro (RN06; módulo `limites`). Lançam erro ao passar do limite. */
export interface ControleDeLimites {
  consumirCadastro(usuario: UsuarioLogado, agora: Date): Promise<void>;
  /** Cadastro que bateu na checagem de duplicata (10/dia). */
  consumirDuplicata(usuarioId: string, agora: Date): Promise<void>;
}

export const CONTROLE_DE_LIMITES = Symbol('CasinhasControleDeLimites');

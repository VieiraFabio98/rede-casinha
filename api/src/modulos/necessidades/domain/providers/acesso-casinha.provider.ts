import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';

/**
 * Trava a casinha até o fim da transação (ações simultâneas nela viram uma fila) e confere se o
 * usuário pode agir nela. Lança erro se ela não existe, está desativada ou oculta para ele.
 */
export interface AcessoCasinha {
  travarParaAcao(usuario: UsuarioLogado, casinhaId: string): Promise<void>;
}

export const ACESSO_CASINHA = Symbol('AcessoCasinha');

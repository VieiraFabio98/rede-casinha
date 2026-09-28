import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import type { Alvo } from '../../../moderacao/domain/entities/denuncia.js';

/** Trava a casinha e confere se o usuário a vê (módulo `casinhas`). */
export interface AcessoCasinha {
  travarParaAcao(usuario: UsuarioLogado, casinhaId: string): Promise<unknown>;
}
export const ACESSO_CASINHA = Symbol('DenunciasAcessoCasinha');

/** Conta 1 denúncia do dia (RN06: 20/dia) ou lança erro (módulo `limites`). */
export interface ControleDeLimites {
  consumirDenuncia(usuarioId: string, agora: Date): Promise<void>;
}
export const CONTROLE_DE_LIMITES = Symbol('DenunciasControleDeLimites');

/** Oculta o alvo até a revisão (módulo `moderacao`, RF06.2). */
export interface OcultacaoAutomatica {
  ocultar(alvo: Alvo, casinhaId: string | null, agora: Date): Promise<void>;
}
export const OCULTACAO_AUTOMATICA = Symbol('OcultacaoAutomatica');

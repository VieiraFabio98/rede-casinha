/**
 * Conta 1 contribuição do dia (RN06: 60 por dia) e lança erro se passar do limite.
 * Módulo `limites`.
 */
export interface ControleDeLimites {
  consumirContribuicao(usuarioId: string, agora: Date): Promise<void>;
}

export const CONTROLE_DE_LIMITES = Symbol('ControleDeLimites');

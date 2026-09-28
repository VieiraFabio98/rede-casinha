import type { AcaoLimitada } from '../limites.js';

export interface LimitesUsoRepository {
  /** Soma 1 uso da ação no dia (atômico) e devolve o total do dia, já contando este. */
  incrementar(usuarioId: string, acao: AcaoLimitada, dia: Date): Promise<number>;
}

export const LIMITES_USO_REPOSITORY = Symbol('LimitesUsoRepository');

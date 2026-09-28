import type { StatusCasinha } from '../entities/casinha.js';

/** Recalcula o status da casinha (RN01) na transação em curso. Módulo `status`. */
export interface RecalculadorDeStatus {
  recalcular(casinhaId: string, agora: Date): Promise<StatusCasinha>;
}

export const RECALCULADOR_DE_STATUS = Symbol('RecalculadorDeStatus');

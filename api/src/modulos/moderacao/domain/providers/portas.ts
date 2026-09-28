/** Recalcula o status da casinha na transação em curso (módulo `status`). */
export interface RecalculadorDeStatus {
  recalcular(casinhaId: string, agora: Date): Promise<unknown>;
}
export const RECALCULADOR_DE_STATUS = Symbol('ModeracaoRecalculadorDeStatus');

/** Pares de casinhas a até 30 m (possíveis duplicatas), com a distância (módulo `localizacao`). */
export interface BuscaDeDuplicatas {
  paresProximos(): Promise<{ a: string; b: string; distanciaM: number }[]>;
}
export const BUSCA_DE_DUPLICATAS = Symbol('BuscaDeDuplicatas');

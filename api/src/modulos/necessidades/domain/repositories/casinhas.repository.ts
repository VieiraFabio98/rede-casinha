import type { StatusCasinha } from '../entities/casinha.js';

/** O que as ações precisam da casinha (a casinha em si é do módulo `casinhas`). */
export interface CasinhasRepository {
  /** "Alguém passou pela casinha" (RN01: conta para o status "ok" e "sem notícias"). */
  registrarVisita(casinhaId: string, em: Date): Promise<void>;
  statusAtual(casinhaId: string): Promise<StatusCasinha>;
}

export const CASINHAS_REPOSITORY = Symbol('NecessidadesCasinhasRepository');

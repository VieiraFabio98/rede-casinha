import type { DenunciaAberta } from '../entities/denuncia.js';

/** As denúncias do lado da moderação (criar denúncia é do módulo `denuncias`). */
export interface DenunciasModeracaoRepository {
  abertas(): Promise<DenunciaAberta[]>;
  existe(id: string): Promise<boolean>;
  /** Fecha as denúncias abertas contra o alvo. */
  fecharDoAlvo(alvoId: string, procedente: boolean, moderadorId: string, em: Date): Promise<void>;
  resolver(id: string, procedente: boolean, moderadorId: string, em: Date): Promise<void>;
}

export const DENUNCIAS_MODERACAO_REPOSITORY = Symbol('DenunciasModeracaoRepository');

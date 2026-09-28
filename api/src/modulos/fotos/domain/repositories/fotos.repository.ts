import type { ArquivosDaFoto, AtividadeDaFoto, Foto, NovaFoto } from '../entities/foto.js';

export interface FotosRepository {
  buscar(id: string): Promise<Foto | null>;
  criar(foto: NovaFoto): Promise<void>;
  /** Fotos de perfil visíveis da casinha. */
  contarDaCasinha(casinhaId: string): Promise<number>;
  atividade(atividadeId: string): Promise<AtividadeDaFoto | null>;
  adotaAtivamente(usuarioId: string, casinhaId: string): Promise<boolean>;
  /** Fotos com `expira_em` já passado (as de atividade, depois de 90 dias). */
  expiradas(agora: Date, limite: number): Promise<ArquivosDaFoto[]>;
  apagar(ids: string[]): Promise<void>;
}

export const FOTOS_REPOSITORY = Symbol('FotosRepository');

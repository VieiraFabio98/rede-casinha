import type { Sessao } from '../entities/conta.js';

export interface SessoesRepository {
  criar(dados: { usuarioId: string; refreshHash: string; expiraEm: Date }): Promise<Sessao>;
  buscarPorRefresh(refreshHash: string): Promise<Sessao | null>;
  /** Condicional: `false` se outra requisição trocou esta sessão ao mesmo tempo (reuso). */
  substituir(id: string, novaId: string, em: Date): Promise<boolean>;
  revogarPorRefresh(refreshHash: string, em: Date): Promise<void>;
  revogarTodas(usuarioId: string, em: Date): Promise<void>;
}

export const SESSOES_REPOSITORY = Symbol('SessoesRepository');

import type {
  MudancasNecessidade,
  Necessidade,
  NovaNecessidade,
  TipoNecessidade,
} from '../entities/necessidade.js';

export interface NecessidadesRepository {
  buscarPorId(id: string): Promise<Necessidade | null>;
  buscarAberta(casinhaId: string, tipo: TipoNecessidade): Promise<Necessidade | null>;
  criar(nova: NovaNecessidade): Promise<void>;
  atualizar(id: string, mudancas: MudancasNecessidade): Promise<void>;
}

export const NECESSIDADES_REPOSITORY = Symbol('NecessidadesRepository');

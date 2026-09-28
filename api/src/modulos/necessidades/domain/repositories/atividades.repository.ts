import type { AtividadeRegistrada, NovaAtividade, TipoAtividade } from '../entities/atividade.js';

export interface AtividadesRepository {
  buscarPorId(id: string): Promise<AtividadeRegistrada | null>;
  /** O usuário fez alguma destas atividades nesta necessidade desde `desde`? */
  existeDoUsuarioDesde(filtro: {
    necessidadeId: string;
    usuarioId: string;
    tipos: TipoAtividade[];
    desde: Date;
  }): Promise<boolean>;
  registrar(nova: NovaAtividade): Promise<void>;
}

export const ATIVIDADES_REPOSITORY = Symbol('AtividadesRepository');

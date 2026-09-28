export interface AdocoesRepository {
  adotaAtivamente(usuarioId: string, casinhaId: string): Promise<boolean>;
  contarAtivas(casinhaId: string): Promise<number>;
  /** Cria a adoção e a atividade `adocao` no histórico. */
  adotar(casinhaId: string, usuarioId: string, em: Date): Promise<void>;
  /** Encerra a adoção ativa (se houver) e registra `fim_adocao`. Devolve se havia uma. */
  encerrar(casinhaId: string, usuarioId: string, em: Date): Promise<boolean>;
}

export const ADOCOES_REPOSITORY = Symbol('AdocoesRepository');

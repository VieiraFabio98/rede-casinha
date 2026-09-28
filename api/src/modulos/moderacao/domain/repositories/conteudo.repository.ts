import type { TipoNecessidade } from '../../../necessidades/domain/entities/necessidade.js';
import type { Alvo } from '../entities/denuncia.js';

/** Casinhas, fotos e necessidades vistas como alvo de moderação. */
export interface ConteudoRepository {
  /** Casinha dona do alvo (a própria, a da foto, a da necessidade). `null` se não existe. */
  casinhaDoAlvo(alvo: Alvo): Promise<string | null>;
  perfilExiste(id: string): Promise<boolean>;
  /**
   * Esconde o alvo. Casinha e foto ganham `moderacao` oculta (a automática só se estava visível);
   * necessidade aberta é cancelada. Devolve se mudou algo.
   */
  ocultar(alvo: Alvo, automatico: boolean): Promise<boolean>;
  /** Casinha ou foto de volta a visível. Devolve se o alvo existe. */
  tornarVisivel(alvo: Alvo): Promise<boolean>;
  necessidade(
    id: string,
  ): Promise<{ casinhaId: string; tipo: TipoNecessidade; status: string } | null>;
  existeAbertaDoTipo(casinhaId: string, tipo: TipoNecessidade): Promise<boolean>;
  reabrirNecessidade(id: string, expiraEm: Date): Promise<void>;
  /** Resumo para a fila: o que é e em que estado está. */
  descrever(alvo: Alvo, agora: Date): Promise<{ descricaoAlvo: string; estadoAlvo: string }>;
}

export const CONTEUDO_REPOSITORY = Symbol('ConteudoRepository');

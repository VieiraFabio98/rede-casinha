import type {
  AtendidaRecente,
  Area,
  CandidataDuplicata,
  CasinhaCompleta,
  CasinhaParaAcao,
  CasinhaResumo,
  NovaCasinha,
  SituacaoCasinha,
} from '../entities/casinha.js';

export interface CasinhasRepository {
  /** Visíveis no mapa (não inativas, não ocultas) dentro da área, até `limite`, em ordem de id. */
  naArea(area: Area, limite: number): Promise<CasinhaResumo[]>;
  /** Não inativas que o usuário criou ou adota (inclusive ocultas), com `souAdotante`. */
  doUsuario(usuarioId: string): Promise<(CasinhaResumo & { souAdotante: boolean })[]>;
  detalhe(id: string): Promise<CasinhaCompleta | null>;
  atendidasDesde(casinhaId: string, desde: Date): Promise<AtendidaRecente[]>;
  /** Trava a casinha até o fim da transação e devolve o que decide o acesso (`null` = não existe). */
  travarParaAcao(casinhaId: string): Promise<CasinhaParaAcao | null>;
  adotaAtivamente(usuarioId: string, casinhaId: string): Promise<boolean>;
  /**
   * Trava o id até o fim da transação, mesmo que a casinha ainda não exista: dois envios
   * simultâneos do mesmo cadastro viram uma fila.
   */
  travarId(id: string): Promise<void>;
  /** Quem criou e em que situação está (idempotência do cadastro). `null` = não existe. */
  existente(id: string): Promise<{ criadaPorId: string | null; situacao: SituacaoCasinha } | null>;
  /** Cria a casinha, a atividade `cadastro` e a adoção do criador. */
  criar(nova: NovaCasinha): Promise<void>;
  /** Nome e primeira foto das casinhas, na ordem dos ids. */
  candidatas(ids: string[]): Promise<CandidataDuplicata[]>;
}

export const CASINHAS_REPOSITORY = Symbol('CasinhasRepository');

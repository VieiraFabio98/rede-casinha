import type { NecessidadeAberta } from '../regras.js';
import type { StatusCasinha } from '../entities/status-casinha.js';

/** O que o cálculo do status (RN01) precisa de uma casinha. */
export interface DadosParaStatus {
  id: string;
  status: StatusCasinha;
  ultimaAtividadeEm: Date;
  abertas: NecessidadeAberta[];
}

export interface StatusRepository {
  /** Trava a casinha até o fim da transação (como as escritas do app). */
  travar(casinhaId: string): Promise<void>;
  dados(casinhaId: string): Promise<DadosParaStatus>;
  gravarStatus(casinhaId: string, status: StatusCasinha): Promise<void>;
  /** Casinhas não inativas, em ordem de id, a partir de `depoisDe` (lotes para o job). */
  loteParaRecalculo(depoisDe: string | null, tamanho: number): Promise<DadosParaStatus[]>;
  /** Casinhas com alguma necessidade aberta e vencida (lote para o job de expiração). */
  casinhasComVencidas(agora: Date, tamanho: number): Promise<string[]>;
  /** Ids das necessidades abertas e vencidas da casinha. */
  vencidas(casinhaId: string, agora: Date): Promise<string[]>;
  /** Marca como expiradas e registra uma atividade `expiracao` (sem autor) para cada uma. */
  expirar(casinhaId: string, necessidadeIds: string[], agora: Date): Promise<void>;
}

export const STATUS_REPOSITORY = Symbol('StatusRepository');

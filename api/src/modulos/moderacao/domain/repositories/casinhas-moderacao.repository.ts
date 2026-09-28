import type { TipoNecessidade } from '../../../necessidades/domain/entities/necessidade.js';
import type {
  SituacaoCasinha,
  StatusModeracao,
} from '../../../casinhas/domain/entities/casinha.js';

export interface CasinhaNaFila {
  id: string;
  nome: string;
  situacao: SituacaoCasinha;
  moderacao: StatusModeracao;
}

export interface PedidoDeDesativacao {
  atividadeId: string;
  casinha: CasinhaNaFila;
  apelido: string | null;
  motivo: string | null;
  criadoEm: Date;
}

/** Casinhas do ponto de vista da moderação (situação, mescla, fila). */
export interface CasinhasModeracaoRepository {
  /** Trava as casinhas (sempre na mesma ordem, contra deadlock). Devolve se todas existem. */
  travar(...casinhaIds: string[]): Promise<boolean>;
  emRevisao(): Promise<CasinhaNaFila[]>;
  porIds(ids: string[]): Promise<CasinhaNaFila[]>;
  /** Pedidos de "a casinha não existe mais" de casinhas ainda não inativas. */
  pedidosDeDesativacao(): Promise<PedidoDeDesativacao[]>;
  mudarSituacao(casinhaId: string, situacao: SituacaoCasinha): Promise<void>;
  situacaoEUltimaAtividade(
    casinhaId: string,
  ): Promise<{ situacao: SituacaoCasinha; ultimaAtividadeEm: Date }>;

  // Mescla (duplicatas)
  necessidadesAbertas(casinhaId: string): Promise<{ id: string; tipo: TipoNecessidade }[]>;
  cancelarNecessidade(id: string): Promise<void>;
  adotantesAtivos(casinhaId: string): Promise<{ id: string; usuarioId: string }[]>;
  encerrarAdocao(adocaoId: string, em: Date): Promise<void>;
  /** Move necessidades, adoções, atividades e fotos da origem para o destino. */
  moverTudo(origemId: string, destinoId: string): Promise<void>;
  marcarMesclada(origemId: string, destinoId: string): Promise<void>;
  definirUltimaAtividade(casinhaId: string, em: Date): Promise<void>;
}

export const CASINHAS_MODERACAO_REPOSITORY = Symbol('CasinhasModeracaoRepository');

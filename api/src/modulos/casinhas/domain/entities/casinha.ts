import type { TipoAtividade } from '../../../necessidades/domain/entities/atividade.js';
import type {
  TipoNecessidade,
  Urgencia,
} from '../../../necessidades/domain/entities/necessidade.js';
import type { StatusCasinha } from '../../../status/domain/entities/status-casinha.js';

export const ANIMAIS_ATENDIDOS = ['caes', 'gatos', 'ambos'] as const;
export type AnimaisAtendidos = (typeof ANIMAIS_ATENDIDOS)[number];
export type SituacaoCasinha = 'ativa' | 'em_revisao' | 'inativa';
export type StatusModeracao = 'visivel' | 'oculto_auto' | 'oculto_moderador';

/** Área visível do mapa (coordenadas públicas). */
export interface Area {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** O que o mapa precisa de uma casinha. A coordenada é a PÚBLICA. */
export interface CasinhaResumo {
  id: string;
  nome: string;
  status: StatusCasinha;
  animais: AnimaisAtendidos;
  latPublica: number;
  lngPublica: number;
  criadaPorId: string | null;
  necessidadesAbertas: TipoNecessidade[];
}

/** O mínimo para decidir se alguém pode agir na casinha (e para travá-la). */
export interface CasinhaParaAcao {
  situacao: SituacaoCasinha;
  moderacao: StatusModeracao;
  criadaPorId: string | null;
}

export interface NecessidadeDoDetalhe {
  id: string;
  tipo: TipoNecessidade;
  urgencia: Urgencia;
  observacao: string | null;
  criadaEm: Date;
  expiraEm: Date;
}

export interface AtividadeDoDetalhe {
  id: string;
  tipo: TipoAtividade;
  necessidade: TipoNecessidade | null;
  /** `null` = conta excluída ("Usuário removido") ou ação do sistema. */
  apelido: string | null;
  observacao: string | null;
  criadaEm: Date;
  /** Foto anexada (visível), se houver. */
  fotoId: string | null;
}

export interface AtendidaRecente {
  id: string;
  tipo: TipoNecessidade;
  atendidaEm: Date;
  apelido: string | null;
}

/** Tudo o que a tela de detalhe mostra (menos a exata, que vem do módulo `localizacao`). */
export interface CasinhaCompleta extends CasinhaParaAcao {
  id: string;
  nome: string;
  descricao: string | null;
  animais: AnimaisAtendidos;
  status: StatusCasinha;
  latPublica: number;
  lngPublica: number;
  ultimaAtividadeEm: Date;
  criadaEm: Date;
  necessidadesAbertas: NecessidadeDoDetalhe[];
  /** Adotantes ativos, na ordem em que adotaram. */
  adotantes: { usuarioId: string; apelido: string }[];
  /** As mais recentes primeiro. */
  atividades: AtividadeDoDetalhe[];
  /** Fotos de perfil visíveis, da mais antiga para a mais nova. */
  fotoIds: string[];
}

/** Casinha nova, com a localização PÚBLICA já sorteada (a exata vai para o módulo `localizacao`). */
export interface NovaCasinha {
  id: string;
  nome: string;
  descricao: string | null;
  animais: AnimaisAtendidos;
  latPublica: number;
  lngPublica: number;
  situacao: SituacaoCasinha;
  criadaPorId: string;
  criadaEm: Date;
  criadaNoCelularEm: Date;
}

/** Casinha a até 30 m de um cadastro: o app pergunta "É uma destas?". Sem coordenadas. */
export interface CandidataDuplicata {
  id: string;
  nome: string;
  /** Primeira foto de perfil visível, se houver. */
  fotoId: string | null;
}

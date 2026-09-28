export const TIPOS_NECESSIDADE = [
  'racao',
  'agua',
  'reforma',
  'cobertas',
  'limpeza',
  'remedio_veterinario',
  'outro',
] as const;
export type TipoNecessidade = (typeof TIPOS_NECESSIDADE)[number];

export const URGENCIAS = ['normal', 'urgente'] as const;
export type Urgencia = (typeof URGENCIAS)[number];

export type StatusNecessidade = 'aberta' | 'atendida' | 'expirada' | 'cancelada';

/** O que a casinha está precisando (RF03). No máximo uma aberta por tipo e casinha (RN02). */
export interface Necessidade {
  id: string;
  casinhaId: string;
  tipo: TipoNecessidade;
  urgencia: Urgencia;
  observacao: string | null;
  status: StatusNecessidade;
  criadaPorId: string | null;
  criadaEm: Date;
  expiraEm: Date;
  atendidaPorId: string | null;
  atendidaEm: Date | null;
}

export interface NovaNecessidade {
  id: string;
  casinhaId: string;
  tipo: TipoNecessidade;
  urgencia: Urgencia;
  observacao?: string;
  criadaPorId: string;
  criadaEm: Date;
  criadaNoCelularEm: Date;
  expiraEm: Date;
  /** A até 100 m da casinha quando reportou? `null` = sem posição. Nunca exposto ao app. */
  validadoLocal: boolean | null;
}

export type MudancasNecessidade = Partial<
  Pick<Necessidade, 'urgencia' | 'status' | 'expiraEm' | 'atendidaPorId' | 'atendidaEm'>
>;

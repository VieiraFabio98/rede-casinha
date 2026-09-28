export const ALVOS_DENUNCIA = ['casinha', 'foto', 'necessidade', 'perfil'] as const;
export type AlvoDenuncia = (typeof ALVOS_DENUNCIA)[number];

export const MOTIVOS_DENUNCIA = [
  'falsa',
  'duplicada',
  'ofensiva',
  'expoe_pessoa',
  'perigo_animais',
  'outro',
] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number];

export type StatusDenuncia = 'aberta' | 'procedente' | 'improcedente';

/** O que foi denunciado. */
export interface Alvo {
  alvoTipo: AlvoDenuncia;
  alvoId: string;
}

export interface DenunciaAberta extends Alvo {
  id: string;
  motivo: MotivoDenuncia;
  descricao: string | null;
  /** `null` = conta excluída. */
  apelido: string | null;
  criadaEm: Date;
}

/** Registro na auditoria (`acoes_moderacao`). `moderadorId = null`: ação automática. */
export interface AcaoDeModeracao {
  moderadorId: string | null;
  acao: string;
  alvoTipo: string;
  alvoId: string;
  motivo?: string;
}

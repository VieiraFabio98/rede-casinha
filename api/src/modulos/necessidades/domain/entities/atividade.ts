export type TipoAtividade =
  | 'cadastro'
  | 'reporte'
  | 'reconfirmacao'
  | 'atendimento'
  | 'contestacao'
  | 'check_in'
  | 'edicao'
  | 'adocao'
  | 'fim_adocao'
  | 'expiracao'
  | 'desativacao_pedida'
  | 'moderacao';

/** Item do histórico da casinha (append-only). O id vem do celular: é a chave de idempotência. */
export interface NovaAtividade {
  id: string;
  casinhaId: string;
  necessidadeId?: string;
  tipo: TipoAtividade;
  usuarioId: string;
  observacao?: string;
  criadaEm: Date;
  criadaNoCelularEm?: Date;
  validadoLocal?: boolean | null;
}

/** O que importa de uma atividade já gravada para tratar um reenvio. */
export interface AtividadeRegistrada {
  usuarioId: string | null;
  necessidadeId: string | null;
}

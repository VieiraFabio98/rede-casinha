import type { StatusModeracao } from '../../../casinhas/domain/entities/casinha.js';

/** Onde estão os arquivos das duas versões de uma foto. */
export interface ArquivosDaFoto {
  id: string;
  chave: string;
  chaveMiniatura: string;
}

export interface Foto extends ArquivosDaFoto {
  casinhaId: string;
  /** `null` = foto de perfil da casinha; senão, anexada a um atendimento, reporte etc. */
  atividadeId: string | null;
  /** `null` = conta excluída. */
  enviadaPorId: string | null;
  moderacao: StatusModeracao;
}

export interface NovaFoto extends ArquivosDaFoto {
  casinhaId: string;
  atividadeId: string | null;
  enviadaPorId: string;
  criadaEm: Date;
  expiraEm: Date | null;
}

/** O que decide se a foto pode ser anexada à atividade. */
export interface AtividadeDaFoto {
  casinhaId: string;
  usuarioId: string | null;
  jaTemFoto: boolean;
}

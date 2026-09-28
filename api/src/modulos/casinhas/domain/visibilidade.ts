import { ehModerador, type UsuarioLogado } from '../../../shared/domain/usuario-logado.js';
import type { StatusCasinha } from '../../status/domain/entities/status-casinha.js';
import type { CasinhaParaAcao } from './entities/casinha.js';

/**
 * Quem pode ver/agir numa casinha:
 * - moderador: sempre;
 * - desativada: ninguém mais;
 * - ocultada por denúncia: só o criador e os adotantes;
 * - senão: qualquer um logado.
 */
export type Acesso = 'permitido' | 'inativa' | 'oculta';

export function acessoACasinha(
  casinha: CasinhaParaAcao,
  usuario: UsuarioLogado,
  souAdotante: boolean,
): Acesso {
  if (ehModerador(usuario)) return 'permitido';
  if (casinha.situacao === 'inativa') return 'inativa';
  if (casinha.moderacao !== 'visivel' && casinha.criadaPorId !== usuario.id && !souAdotante) {
    return 'oculta';
  }
  return 'permitido';
}

/** Ordem de "Minhas casinhas": urgente primeiro; "sem notícias" antes de "ok". */
export const GRAVIDADE: Record<StatusCasinha, number> = {
  urgente: 0,
  atencao: 1,
  sem_noticias: 2,
  ok: 3,
};

/** 6 casas decimais (~11 cm): precisão de sobra e resposta menor. */
export const arredondarCoordenada = (grau: number) => Math.round(grau * 1e6) / 1e6;

/** Máximo de casinhas por busca de área. */
export const LIMITE_POR_AREA = 1_000;
/** Atividades no detalhe. */
export const ATIVIDADES_NO_DETALHE = 30;
/** Janela em que um atendimento ainda pode ser contestado (RN03): o detalhe mostra o botão. */
export const JANELA_CONTESTACAO_MS = 24 * 60 * 60 * 1000;

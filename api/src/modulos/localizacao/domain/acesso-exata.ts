import { type NivelAcesso, ORDEM_NIVEL } from '../../../shared/domain/usuario-logado.js';

/** Casinhas distintas com localização exata que um verificado pode ver por dia (RN06). */
export const LIMITE_EXATAS_POR_DIA = 50;

/**
 * - `livre`: vê a exata sempre (moderador, ou criador/adotante DESTA casinha).
 * - `cota_diaria`: vê enquanto houver cota no dia, com registro em `acessos_localizacao` (verificado).
 * - `negado`: só a pública.
 */
export type AcessoExata = 'livre' | 'cota_diaria' | 'negado';

export function acessoAExata(quem: {
  nivel: NivelAcesso;
  souCriador: boolean;
  souAdotante: boolean;
}): AcessoExata {
  if (ORDEM_NIVEL[quem.nivel] >= ORDEM_NIVEL.moderador) return 'livre';
  if (quem.souCriador || quem.souAdotante) return 'livre';
  if (quem.nivel === 'verificado') return 'cota_diaria';
  return 'negado';
}

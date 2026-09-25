import type { CasinhaNoMapa, TipoNecessidade } from '@/api/tipos';

export interface Filtros {
  soUrgentes: boolean;
  /** Vazio = todos os tipos. Com tipos, mostra as casinhas que precisam de pelo menos um deles. */
  tipos: TipoNecessidade[];
}

export const SEM_FILTROS: Filtros = { soUrgentes: false, tipos: [] };

export const temFiltro = (f: Filtros) => f.soUrgentes || f.tipos.length > 0;

export function filtrarCasinhas(casinhas: CasinhaNoMapa[], f: Filtros): CasinhaNoMapa[] {
  if (!temFiltro(f)) return casinhas;
  return casinhas.filter(
    (c) =>
      (!f.soUrgentes || c.status === 'urgente') &&
      (f.tipos.length === 0 || c.necessidadesAbertas.some((tipo) => f.tipos.includes(tipo))),
  );
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from './cliente';
import type { Area, CasinhaDetalhe, CasinhasNaArea, MinhaCasinha } from './tipos';

export const chavesCasinhas = {
  todas: ['casinhas'] as const,
  area: (area: Area | null) => ['casinhas', 'area', area] as const,
  detalhe: (id: string) => ['casinhas', 'detalhe', id] as const,
  minhas: ['casinhas', 'minhas'] as const,
};

const paraQuery = (area: Area) =>
  new URLSearchParams(Object.entries(area).map(([chave, valor]) => [chave, String(valor)]));

/**
 * Casinhas da área visível do mapa. `null` enquanto a área não é conhecida.
 * Ao mudar de área, mantém as anteriores na tela até as novas chegarem.
 */
export function useCasinhasNaArea(area: Area | null) {
  return useQuery({
    queryKey: chavesCasinhas.area(area),
    queryFn: () => api<CasinhasNaArea>(`/casinhas?${paraQuery(area!)}`),
    enabled: area !== null,
    placeholderData: keepPreviousData,
  });
}

/** Detalhe da casinha. Para o verificado, abrir uma casinha nova gasta 1 da cota de exatas do dia. */
export function useCasinha(id: string) {
  return useQuery({
    queryKey: chavesCasinhas.detalhe(id),
    queryFn: () => api<CasinhaDetalhe>(`/casinhas/${encodeURIComponent(id)}`),
  });
}

/** Casinhas que o usuário criou ou adota. */
export function useMinhasCasinhas() {
  return useQuery({
    queryKey: chavesCasinhas.minhas,
    queryFn: () => api<MinhaCasinha[]>('/me/casinhas'),
  });
}

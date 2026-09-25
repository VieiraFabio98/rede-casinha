import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

import { armazenamentoRapido } from '@/offline/armazenamento-rapido';

import { ErroApi } from './cliente';

/** Quanto tempo os dados ficam guardados no aparelho para uso offline. */
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cache das leituras da API (TanStack Query), guardado no MMKV para o mapa abrir offline.
 * É apagado ao sair da conta (`apagarCache`): pode conter localizações exatas que só o
 * usuário anterior tinha permissão de ver.
 */
export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Precisa durar tanto quanto o cache persistido, senão some antes de ser salvo.
      gcTime: SETE_DIAS,
      // Erro 4xx (sem permissão, não encontrada) não melhora tentando de novo.
      retry: (falhas, erro) =>
        falhas < 2 && !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500),
    },
  },
});

const persistidor = createAsyncStoragePersister({
  storage: {
    getItem: (chave) => armazenamentoRapido.getString(chave) ?? null,
    setItem: (chave, valor) => armazenamentoRapido.set(chave, valor),
    removeItem: (chave) => void armazenamentoRapido.remove(chave),
  },
  key: 'cache-consultas',
  throttleTime: 2_000,
});

export const opcoesPersistencia: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: persistidor,
  maxAge: SETE_DIAS,
  // Mudou o formato das respostas guardadas? Troque a versão para descartar o cache antigo.
  buster: '1',
  dehydrateOptions: {
    // Só as casinhas (mapa, detalhe, minhas), e só as que carregaram certo.
    shouldDehydrateQuery: (consulta) =>
      consulta.queryKey[0] === 'casinhas' && consulta.state.status === 'success',
  },
};

/** Apaga o cache em memória e o guardado no aparelho (ao sair da conta). */
export async function apagarCache() {
  clienteConsultas.clear();
  await persistidor.removeClient();
}

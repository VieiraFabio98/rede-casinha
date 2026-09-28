import { chavesCasinhas } from '@/api/casinhas';
import type { CasinhaDetalhe } from '@/api/tipos';
import { enfileirar } from '@/offline/outbox/fila';

import type { FotoPreparada } from './pendentes';
import { type CorpoFoto, OPERACAO_FOTO } from './upload';

/**
 * Põe a foto na fila (sobe quando der, online ou depois). Na tela ela aparece na hora, a partir
 * do arquivo local. Sem `atividadeId`, é foto de perfil da casinha.
 */
export async function enviarFoto(casinhaId: string, foto: FotoPreparada, atividadeId?: string) {
  const corpo: CorpoFoto = {
    casinhaId,
    ...(atividadeId && { atividadeId }),
    arquivo: foto.arquivo,
    miniatura: foto.miniatura,
  };
  const local = { id: foto.id, url: foto.arquivo, urlMiniatura: foto.miniatura };
  await enfileirar(
    { id: foto.id, operacao: OPERACAO_FOTO, metodo: 'PUT', caminho: `/fotos/${foto.id}`, corpo },
    (cliente) =>
      cliente.setQueryData<CasinhaDetalhe>(chavesCasinhas.detalhe(casinhaId), (d) => {
        if (!d) return d;
        if (!atividadeId) return { ...d, fotos: [...d.fotos, local] };
        return {
          ...d,
          atividades: d.atividades.map((a) => (a.id === atividadeId ? { ...a, foto: local } : a)),
        };
      }),
  );
}

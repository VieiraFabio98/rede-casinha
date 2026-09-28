import { File } from 'expo-file-system';

import { api, ErroApi } from '@/api/cliente';
import type { FotoUrls } from '@/api/tipos';
import { textos } from '@/i18n/pt-BR';
import type { ItemOutbox } from '@/offline/outbox/tipos';

import { arquivoExiste } from './pendentes';

/** Nome da operação de foto na outbox (tela "Pendências"). */
export const OPERACAO_FOTO = 'enviar_foto';

/** O que a outbox guarda de uma foto: os campos do multipart e onde estão os arquivos. */
export interface CorpoFoto {
  casinhaId: string;
  atividadeId?: string;
  arquivo: string;
  miniatura: string;
}

export const ehFoto = (item: ItemOutbox): item is ItemOutbox & { corpo: CorpoFoto } =>
  item.operacao === OPERACAO_FOTO;

/**
 * Arquivo local como parte do multipart. O `fetch` do Expo (SDK 57) não aceita o formato
 * `{ uri, name, type }` do React Native: só `Blob` ou o `File` do expo-file-system, de onde
 * tira o nome (`<id>.jpg`) e o tipo (`image/jpeg`).
 */
const anexo = (uri: string) => new File(uri) as unknown as Blob;

/** `PUT /fotos/:id` em multipart. Chamado pelo worker da fila. */
export const subirFoto = (item: ItemOutbox & { corpo: CorpoFoto }) =>
  subirArquivosDaFoto(item.id, item.corpo);

/** Sobe uma foto já preparada (também usado pelo cadastro de casinha, depois do `POST`). */
export async function subirArquivosDaFoto(fotoId: string, dados: CorpoFoto): Promise<FotoUrls> {
  const { casinhaId, atividadeId, arquivo, miniatura } = dados;
  if (!arquivoExiste(arquivo) || !arquivoExiste(miniatura)) {
    // Erro permanente (4xx): repetir não traz o arquivo de volta.
    throw new ErroApi(410, textos.fotos.naoEstaMaisNoCelular);
  }
  const corpo = new FormData();
  corpo.append('casinhaId', casinhaId);
  if (atividadeId) corpo.append('atividadeId', atividadeId);
  corpo.append('foto', anexo(arquivo));
  corpo.append('miniatura', anexo(miniatura));
  return api<FotoUrls>(`/fotos/${fotoId}`, { metodo: 'PUT', corpo });
}

/** Arquivos locais do item de foto (para apagar quando ele sai da fila). */
export const arquivosDaFoto = (item: ItemOutbox): string[] =>
  ehFoto(item) ? [item.corpo.arquivo, item.corpo.miniatura] : [];

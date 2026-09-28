import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { LADO_FOTO, LADO_MINIATURA, QUALIDADE_JPEG, redimensionamento } from './dimensoes';

/** Foto pronta para enviar: as duas versões em `documentDirectory/pendentes/`. */
export interface FotoPreparada {
  /** Gerado aqui: é o id da foto na API (upload idempotente). */
  id: string;
  arquivo: string;
  miniatura: string;
}

export interface FotoOriginal {
  uri: string;
  width: number;
  height: number;
}

/**
 * Fica nos documentos do app (não no cache, que o sistema pode limpar): a foto espera ali até a
 * fila conseguir enviar, mesmo que isso leve dias sem internet.
 */
function pastaPendentes(): Directory {
  const pasta = new Directory(Paths.document, 'pendentes');
  pasta.create({ idempotent: true, intermediates: true });
  return pasta;
}

/** Reencoda em JPEG: o arquivo novo não leva o EXIF da original (nem o GPS). */
async function versao(original: FotoOriginal, ladoMaximo: number, destino: File) {
  const contexto = ImageManipulator.manipulate(original.uri).resize(
    redimensionamento(original.width, original.height, ladoMaximo),
  );
  const imagem = await contexto.renderAsync();
  try {
    const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE_JPEG });
    new File(salva.uri).moveSync(destino);
    return destino.uri;
  } finally {
    imagem.release();
    contexto.release();
  }
}

/** Gera a foto de 1024 px e a miniatura de 320 px, sem EXIF, prontas para a fila. */
export async function prepararFoto(original: FotoOriginal): Promise<FotoPreparada> {
  const id = randomUUID();
  const pasta = pastaPendentes();
  const [arquivo, miniatura] = await Promise.all([
    versao(original, LADO_FOTO, new File(pasta, `${id}.jpg`)),
    versao(original, LADO_MINIATURA, new File(pasta, `${id}_t.jpg`)),
  ]);
  return { id, arquivo, miniatura };
}

export const arquivoExiste = (uri: string) => new File(uri).exists;

/** Apaga os arquivos locais (depois do envio ou ao descartar). Arquivo que já não existe é ignorado. */
export function apagarArquivos(...uris: string[]) {
  for (const uri of uris) {
    try {
      const arquivo = new File(uri);
      if (arquivo.exists) arquivo.delete();
    } catch {
      // Sobra um arquivo pequeno na pasta: não vale travar a fila por isso.
    }
  }
}

import { subirArquivosDaFoto } from '@/fotos/upload';
import type { FotoPreparada } from '@/fotos/pendentes';
import { textos } from '@/i18n/pt-BR';
import type { ItemOutbox } from '@/offline/outbox/tipos';
import { ehErroTemporario } from '@/offline/outbox/worker';

import { api, ErroApi } from './cliente';
import type { AnimaisAtendidos, ResultadoCadastro } from './tipos';

/** Nome da operação na outbox (tela "Pendências"). */
export const OPERACAO_CADASTRO = 'cadastrar_casinha';

/** O que a outbox guarda de um cadastro: o corpo do `POST /casinhas` e as fotos locais. */
export interface CorpoCadastro {
  id: string;
  nome: string;
  animais: AnimaisAtendidos;
  descricao?: string;
  lat: number;
  lng: number;
  precisaoM: number;
  ajusteManual: boolean;
  /** "É nova": cria mesmo com casinha a até 30 m (em revisão). */
  forcar: boolean;
  criadaNoCelularEm: string;
  fotos: FotoPreparada[];
}

export const ehCadastro = (item: ItemOutbox): item is ItemOutbox & { corpo: CorpoCadastro } =>
  item.operacao === OPERACAO_CADASTRO;

/**
 * Envia o cadastro (chamado pelo worker): `POST /casinhas` e depois as fotos, todos idempotentes.
 * Se a fila repetir o item, nada duplica.
 * - Possível duplicata: vira erro permanente com as candidatas (a pessoa decide em "Pendências").
 * - Foto recusada de vez (ex.: limite do dia): a casinha fica sem ela, o cadastro segue.
 */
export async function subirCadastro(
  item: ItemOutbox & { corpo: CorpoCadastro },
): Promise<ResultadoCadastro> {
  const { fotos, ...corpo } = item.corpo;
  const resultado = await api<ResultadoCadastro>('/casinhas', { metodo: 'POST', corpo });
  if (resultado.resultado === 'possivel_duplicata') {
    throw new ErroApi(
      409,
      textos.novaCasinha.duplicataPendente,
      'possivel_duplicata',
      resultado.candidatas,
    );
  }
  for (const foto of fotos) {
    try {
      await subirArquivosDaFoto(foto.id, {
        casinhaId: corpo.id,
        arquivo: foto.arquivo,
        miniatura: foto.miniatura,
      });
    } catch (erro) {
      if (ehErroTemporario(erro)) throw erro;
    }
  }
  return resultado;
}

/** Arquivos locais das fotos do cadastro (para apagar quando ele sai da fila). */
export const arquivosDoCadastro = (item: ItemOutbox): string[] =>
  ehCadastro(item) ? item.corpo.fotos.flatMap((f) => [f.arquivo, f.miniatura]) : [];

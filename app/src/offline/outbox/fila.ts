import { randomUUID } from 'expo-crypto';

import { api } from '@/api/cliente';
import { clienteConsultas } from '@/api/consultas';

import { criarArmazemSqlite } from './armazem-sqlite';
import type { ItemOutbox, NovaOperacao } from './tipos';
import { criarWorker } from './worker';

const armazem = criarArmazemSqlite();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((ouvinte) => ouvinte());
const ouvintesDeResposta = new Set<(item: ItemOutbox, resposta: unknown) => void>();

const worker = criarWorker({
  armazem,
  enviar: (item) => api(item.caminho, { metodo: item.metodo, corpo: item.corpo }),
  aoMudar: avisar,
  aoEnviado: (item, resposta) => ouvintesDeResposta.forEach((ouvinte) => ouvinte(item, resposta)),
});

let usuarioAtual: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Id para uma operação nova (vai no corpo da requisição e na outbox). */
export const novoId = () => randomUUID();

/** A fila avisa aqui quando muda (contador, tela "Pendências"). Devolve o cancelamento. */
export function assinarFila(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => void ouvintes.delete(ouvinte);
}

/** Respostas do servidor às operações enviadas (online ou depois, quando a rede voltou). */
export function assinarRespostas(ouvinte: (item: ItemOutbox, resposta: unknown) => void) {
  ouvintesDeResposta.add(ouvinte);
  return () => void ouvintesDeResposta.delete(ouvinte);
}

export const listarFila = (): Promise<ItemOutbox[]> =>
  usuarioAtual ? armazem.listar(usuarioAtual) : Promise.resolve([]);

/**
 * Usuário logado (ou `null` ao sair). A fila só envia as operações dele: se outra conta
 * entrar no mesmo celular, as do anterior esperam ele voltar.
 */
export async function definirUsuarioDaFila(usuarioId: string | null) {
  if (usuarioAtual === usuarioId) return;
  usuarioAtual = usuarioId;
  if (timer) clearTimeout(timer);
  timer = null;
  avisar();
  if (usuarioId) {
    // Algo ficou "enviando" quando o app foi fechado no meio: volta para a fila.
    await armazem.recuperarInterrompidos();
    sincronizar();
  }
}

/** Tenta enviar o que está na fila (sem efeito se não há usuário ou se já está enviando). */
export function sincronizar() {
  const usuario = usuarioAtual;
  if (!usuario) return;
  worker
    .processar(usuario)
    .then(({ enviados, proximaEm }) => {
      // Depois do envio, recarrega do servidor o que a UI otimista mostrou.
      if (enviados > 0) clienteConsultas.invalidateQueries({ queryKey: ['casinhas'] });
      if (timer) clearTimeout(timer);
      timer =
        proximaEm === null
          ? null
          : setTimeout(sincronizar, Math.max(1_000, proximaEm - Date.now()));
    })
    .catch(() => {
      // Falha do próprio SQLite: o intervalo de 2 min tenta de novo.
    });
}

/**
 * Guarda uma escrita para enviar assim que der. A tela mostra o resultado na hora
 * (`otimista`, com `setQueryData`) e a fila cuida do envio, online ou offline.
 */
export async function enfileirar(
  operacao: NovaOperacao,
  otimista?: (cliente: typeof clienteConsultas) => void,
) {
  if (!usuarioAtual) throw new Error('Entre na sua conta para continuar');
  await armazem.inserir({
    ...operacao,
    usuarioId: usuarioAtual,
    status: 'pendente',
    tentativas: 0,
    proximaTentativaEm: null,
    ultimoErro: null,
    criadoEm: Date.now(),
  });
  otimista?.(clienteConsultas);
  avisar();
  sincronizar();
}

/** "Tentar agora": ignora a espera do backoff. */
export async function tentarAgora() {
  if (!usuarioAtual) return;
  await armazem.liberarEspera(usuarioAtual);
  sincronizar();
}

/** Descarta um item (na tela "Pendências", só os com erro permanente). */
export async function descartar(id: string) {
  await armazem.remover(id);
  avisar();
}

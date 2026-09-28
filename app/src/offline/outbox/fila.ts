import { randomUUID } from 'expo-crypto';

import { api } from '@/api/cliente';
import { arquivosDoCadastro, ehCadastro, subirCadastro } from '@/api/cadastro-envio';
import { clienteConsultas } from '@/api/consultas';
import { apagarArquivos } from '@/fotos/pendentes';
import { arquivosDaFoto, ehFoto, subirFoto } from '@/fotos/upload';

import { criarArmazemSqlite } from './armazem-sqlite';
import type { ItemOutbox, NovaOperacao } from './tipos';
import { criarWorker } from './worker';

const armazem = criarArmazemSqlite();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((ouvinte) => ouvinte());
const ouvintesDeResposta = new Set<(item: ItemOutbox, resposta: unknown) => void>();

/** Fotos locais que o item levava: saem do celular quando ele sai da fila. */
const liberarArquivos = (item: ItemOutbox) =>
  apagarArquivos(...arquivosDaFoto(item), ...arquivosDoCadastro(item));

const worker = criarWorker({
  armazem,
  enviar: (item) => {
    if (ehFoto(item)) return subirFoto(item);
    if (ehCadastro(item)) return subirCadastro(item);
    return api(item.caminho, { metodo: item.metodo, corpo: item.corpo });
  },
  aoMudar: avisar,
  aoEnviado: (item, resposta) => {
    // Só depois de o item sair da fila: se o app fechar antes, a foto ainda pode ser reenviada.
    liberarArquivos(item);
    ouvintesDeResposta.forEach((ouvinte) => ouvinte(item, resposta));
  },
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
    codigoErro: null,
    detalheErro: null,
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

/** Conta excluída: apaga da fila tudo o que era dela. */
export async function apagarFilaDoUsuario(usuarioId: string) {
  const itens = await armazem.listar(usuarioId);
  await armazem.removerDoUsuario(usuarioId);
  itens.forEach(liberarArquivos);
  avisar();
}

export type ResultadoEnvio =
  | { tipo: 'enviado'; resposta: unknown }
  | { tipo: 'erro'; item: ItemOutbox }
  | { tipo: 'pendente' };

/**
 * Espera um item da fila sair (enviado) ou dar erro permanente, por até `ms`. Com internet a
 * resposta vem em segundos; sem, devolve `pendente` e a fila segue tentando sozinha.
 */
export function aguardarEnvio(id: string, ms = 10_000): Promise<ResultadoEnvio> {
  return new Promise((resolver) => {
    let resposta: unknown;
    let terminou = false;
    const terminar = (resultado: ResultadoEnvio) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(timer);
      pararFila();
      pararRespostas();
      resolver(resultado);
    };
    const conferir = () =>
      listarFila()
        .then((itens) => {
          const item = itens.find((i) => i.id === id);
          if (!item) terminar({ tipo: 'enviado', resposta });
          else if (item.status === 'erro_permanente') terminar({ tipo: 'erro', item });
        })
        .catch(() => {});
    const timer = setTimeout(() => terminar({ tipo: 'pendente' }), ms);
    const pararRespostas = assinarRespostas((item, r) => {
      if (item.id === id) resposta = r;
    });
    const pararFila = assinarFila(conferir);
    conferir();
  });
}

/**
 * Tenta de novo um item com erro permanente, com o corpo mudado (ex.: "É nova" no cadastro).
 * Volta para a fila na mesma posição (a ordem de criação não muda).
 */
export async function reenviar(id: string, mudarCorpo: (corpo: unknown) => unknown) {
  const item = usuarioAtual
    ? (await armazem.listar(usuarioAtual)).find((i) => i.id === id)
    : undefined;
  if (!item) return;
  await armazem.atualizar(id, {
    corpo: mudarCorpo(item.corpo),
    status: 'pendente',
    tentativas: 0,
    proximaTentativaEm: null,
    ultimoErro: null,
    codigoErro: null,
    detalheErro: null,
  });
  avisar();
  sincronizar();
}

/** Descarta um item (na tela "Pendências", só os com erro permanente). */
export async function descartar(id: string) {
  const item = usuarioAtual
    ? (await armazem.listar(usuarioAtual)).find((i) => i.id === id)
    : undefined;
  await armazem.remover(id);
  if (item) liberarArquivos(item);
  avisar();
}

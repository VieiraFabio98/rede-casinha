import { ErroApi } from '@/api/cliente';

import type { ArmazemOutbox, ItemOutbox } from './tipos';

const ESPERA_INICIAL_MS = 10_000;
export const ESPERA_MAXIMA_MS = 30 * 60_000;

/** Backoff exponencial: 10 s, 20 s, 40 s… até 30 min. */
export function esperaAposFalha(tentativas: number): number {
  return Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** Math.max(0, tentativas - 1));
}

/**
 * Vale tentar de novo? Rede, 5xx, 408, 429 e 401 (sessão sendo renovada) sim.
 * Outro 4xx é regra de negócio (limite, sem permissão, casinha inativa): repetir não adianta.
 * Erro inesperado (não veio da API) também tenta de novo: melhor atrasar do que perder a ação.
 */
export function ehErroTemporario(erro: unknown): boolean {
  if (!(erro instanceof ErroApi)) return true;
  const { status } = erro;
  return status === 0 || status >= 500 || status === 401 || status === 408 || status === 429;
}

const mensagemDoErro = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro));
const codigoDoErro = (erro: unknown) => (erro instanceof ErroApi ? (erro.codigo ?? null) : null);
const detalheDoErro = (erro: unknown) => (erro instanceof ErroApi ? (erro.dados ?? null) : null);

export interface ResultadoRodada {
  enviados: number;
  /** Quando vale rodar de novo (epoch ms), se a fila parou esperando um backoff. */
  proximaEm: number | null;
}

export interface DependenciasWorker {
  armazem: ArmazemOutbox;
  /** Chama a API e devolve a resposta. Lança `ErroApi` em caso de falha. */
  enviar: (item: ItemOutbox) => Promise<unknown>;
  agora?: () => number;
  /** A fila mudou (para a UI recarregar a contagem). */
  aoMudar?: () => void;
  /** Um item chegou ao servidor (ex.: avisar "alguém já tinha atendido"). */
  aoEnviado?: (item: ItemOutbox, resposta: unknown) => void;
}

/**
 * Sync worker da outbox: um envio por vez, em ordem de criação (uma casinha criada offline
 * precisa existir antes dos reportes nela). Erro temporário para a fila e agenda nova tentativa;
 * erro permanente tira o item da frente (fica na tela "Pendências") e a fila continua.
 */
export function criarWorker({
  armazem,
  enviar,
  agora = Date.now,
  aoMudar,
  aoEnviado,
}: DependenciasWorker) {
  let emAndamento: Promise<ResultadoRodada> | null = null;

  async function rodada(usuarioId: string): Promise<ResultadoRodada> {
    let enviados = 0;
    for (;;) {
      const item = await armazem.primeiroPendente(usuarioId);
      if (!item) return { enviados, proximaEm: null };
      if (item.proximaTentativaEm !== null && item.proximaTentativaEm > agora()) {
        return { enviados, proximaEm: item.proximaTentativaEm };
      }

      await armazem.atualizar(item.id, { status: 'enviando' });
      try {
        const resposta = await enviar(item);
        await armazem.remover(item.id);
        enviados++;
        aoEnviado?.(item, resposta);
      } catch (erro) {
        const tentativas = item.tentativas + 1;
        if (ehErroTemporario(erro)) {
          const proximaEm = agora() + esperaAposFalha(tentativas);
          await armazem.atualizar(item.id, {
            status: 'pendente',
            tentativas,
            proximaTentativaEm: proximaEm,
            ultimoErro: mensagemDoErro(erro),
            codigoErro: codigoDoErro(erro),
            detalheErro: detalheDoErro(erro),
          });
          aoMudar?.();
          return { enviados, proximaEm };
        }
        await armazem.atualizar(item.id, {
          status: 'erro_permanente',
          tentativas,
          ultimoErro: mensagemDoErro(erro),
          codigoErro: codigoDoErro(erro),
          detalheErro: detalheDoErro(erro),
        });
      }
      aoMudar?.();
    }
  }

  return {
    /** Envia o que der. Se já houver uma rodada em andamento, devolve a mesma (lock). */
    processar(usuarioId: string): Promise<ResultadoRodada> {
      emAndamento ??= rodada(usuarioId).finally(() => {
        emAndamento = null;
      });
      return emAndamento;
    },
  };
}

/**
 * Unidade de trabalho. Tudo o que os repositórios fazem dentro de `executar` vai numa única
 * transação do banco (e é desfeito junto se algo lançar erro). Chamadas aninhadas reaproveitam
 * a transação de fora.
 */
export interface Transacao {
  executar<T>(trabalho: () => Promise<T>): Promise<T>;
}

export const TRANSACAO = Symbol('Transacao');

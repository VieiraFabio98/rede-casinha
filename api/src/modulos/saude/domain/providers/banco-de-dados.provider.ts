/** O banco está respondendo? (para o monitoramento e o deploy). */
export interface BancoDeDados {
  responde(): Promise<boolean>;
}

export const BANCO_DE_DADOS = Symbol('BancoDeDados');

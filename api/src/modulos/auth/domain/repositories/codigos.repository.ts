import type { CodigoPendente } from '../entities/conta.js';

export interface CodigosRepository {
  ultimoPedidoEm(email: string): Promise<Date | null>;
  contarPedidosDesde(email: string, desde: Date): Promise<number>;
  /** Só o código mais recente vale: os pendentes expiram em `agora`. */
  expirarPendentes(email: string, agora: Date): Promise<void>;
  criar(dados: {
    email: string;
    codigoHash: string;
    criadoEm: Date;
    expiraEm: Date;
  }): Promise<void>;
  pendenteMaisRecente(email: string, agora: Date): Promise<CodigoPendente | null>;
  registrarTentativa(id: string): Promise<void>;
  /** Condicional: `false` se outra verificação usou o código ao mesmo tempo. */
  marcarUsado(id: string, em: Date): Promise<boolean>;
}

export const CODIGOS_REPOSITORY = Symbol('CodigosRepository');

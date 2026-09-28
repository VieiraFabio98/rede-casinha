/** Códigos de 6 dígitos, guardados só como HMAC (baixa entropia). */
export interface CodigosDeLogin {
  gerar(): string;
  hash(email: string, codigo: string): string;
  /** Comparação em tempo constante. */
  confere(email: string, codigo: string, hash: string): boolean;
}

export const CODIGOS_DE_LOGIN = Symbol('CodigosDeLogin');

/** Envia o código por e-mail. */
export interface EnvioDeCodigo {
  enviar(email: string, codigo: string, validadeMinutos: number): Promise<void>;
}

export const ENVIO_DE_CODIGO = Symbol('EnvioDeCodigo');

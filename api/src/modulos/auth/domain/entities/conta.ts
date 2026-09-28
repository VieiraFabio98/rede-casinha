/** Conta de login (tabela `usuario`); o perfil público é do módulo `me`. */
export interface Conta {
  id: string;
  email: string;
  googleSub: string | null;
  /** Só a conta de demonstração do revisor da loja tem senha. */
  senhaHash: string | null;
  emailVerificadoEm: Date | null;
}

export interface CodigoPendente {
  id: string;
  codigoHash: string;
  tentativas: number;
}

export interface Sessao {
  id: string;
  usuarioId: string;
  expiraEm: Date;
  revogadaEm: Date | null;
  substituidaPor: string | null;
}

export interface Tokens {
  acesso: string;
  acessoExpiraEm: Date;
  refresh: string;
  refreshExpiraEm: Date;
}

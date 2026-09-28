/** JWT de acesso curto + refresh token opaco, guardado só como hash. */
export interface EmissorDeTokens {
  acesso(usuarioId: string, agora: Date): Promise<{ acesso: string; acessoExpiraEm: Date }>;
  novoRefresh(agora: Date): { refresh: string; refreshHash: string; refreshExpiraEm: Date };
  hashDoRefresh(refresh: string): string;
}

export const EMISSOR_DE_TOKENS = Symbol('EmissorDeTokens');
